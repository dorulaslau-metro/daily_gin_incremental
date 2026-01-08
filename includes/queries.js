const date_filter_var = `DATE_SUB(CURRENT_DATE('Europe/Bucharest'),INTERVAL 12 MONTH)`;
const date_filter_incremental = `DATE_SUB(CURRENT_DATE('Europe/Bucharest'),INTERVAL 12 MONTH)`;


const gin_operational_XX = (c) => `


select a.*, 
b.Suppliers_type,b.Supplier_SSCC,b.date_from as SSCC_status_date_from,
CONCAT(a.Store_no,'. ', c.store_desc)  as Store_name, 
d.is_platform,d.supplier_name, d.eng_supplier_name_without_special_characters,
(CASE
        WHEN a.Date > c.MS_penetration_date THEN 'Stores activated in MStore'
        ELSE 'Stores active only in MMS'
    END) AS Stores_Penetration,
(CASE
        WHEN a.Date > m.MS_integration_date THEN 'GR types available in MStore'
        ELSE 'GR types available only in MMS'
    END) AS GR_types_Integration,
xx.tunit_no,xx.tunits_pallet,xx.date_from, xx.date_to, yy.tunit_qty
from

(SELECT 
gr_no,gr_id,
CONCAT(gr_no,store_no) as GR_PK, gr_id as GR_FK,
CONCAT(gr_no,store_no,(article_no*1000000+variant*1000+bundle_no)) as Article_PK,
'${c.iso2}' as Country,
cast(SUBSTR(gr_creation_date, 1, 10) As DATE FORMAT 'yyyy-mm-dd') as Date,
cast(SUBSTR(gr_validation2_date, 1, 10) As DATE FORMAT 'yyyy-mm-dd') as Validation_Date,
store_no as Store_no, 
(case when gr_creation_source=5 then 'MStore' else 'MMS' end) as Tool,
'mw_kpi_goods_receiving'as Data_source,
(case when gr_creation_source=1 then 'GR created manually in MMS ST'
 when gr_creation_source= 2 then 'GR in MMS ST Mobile'
 when gr_creation_source=3 then 'SSCC GR MMS ST Mobile'
 when gr_creation_source=4 then 'GR automatically (including DESADV, IST from, GRs from 3PL, GRC from IC)'
 when gr_creation_source=5 then ' GR done in MStore GIN'
 else null end) as GR_Creation_source,
gr_type as GR_type_no, 
(case 
when gr_type = 1 then '1. Pool GR' 
when gr_type = 10 then '10. Transf. to Consignment'
when gr_type = 11 then '11. Transf. from Consignment'
when gr_type = 12 then '12. Credit/Debit note for Goods'
when gr_type = 14 then '14. GRC Consignment'
when gr_type = 15 then '15. Pool GR Consignment'
when gr_type = 17 then '17. Goods Issue'
when gr_type = 2 then '2. Manual GR'
when gr_type = 3 then '3. Transfer to'
when gr_type = 4 then '4. Transfer from'
when gr_type = 5 then '5. Return'
when gr_type = 6 then '6. GRC'
when gr_type = 7 then '7. Correction'
when gr_type = 8 then '8. Manual Consignment'
when gr_type = 9 then '9. Return Consignment'
else cast(gr_type as string)||". Missing label" end) as GR_type_name,
(article_no*1000000+variant*1000+bundle_no) as Article_id,
article_no,
bundle_no,
gr_quantity as GoodsReceiving_quantity,
order_quantity as Order_quantity, 
dn_quantity as DeliveryNote_quantity, 
supplier_no as Supplier_no,
ls_no as dn_no_fk, pos_no as Position_no,
store_id,
PARTITIONTIME
FROM
(WITH ranked_mms AS (
SELECT pkc.*, RANK() OVER (PARTITION BY pkc.gr_no||pkc.store_no||pkc.article_no ORDER BY dana_ingestion_timestamp DESC) AS rank
    FROM metro-bi-dl-${c.internal.toLowerCase()}-prod.ingest_mmsstore_stgr.mw_kpi_goods_receiving pkc
    WHERE DATE(PARTITIONTIME) >= ${date_filter_incremental}
       )
SELECT
DISTINCT
*
FROM ranked_mms
WHERE rank = 1) 
-- where cast(SUBSTR(gr_creation_date, 1, 10) As DATE FORMAT 'yyyy-mm-dd')>= ${date_filter_var} 
 ) a 
left join
(WITH LatestDates AS (
    SELECT
        suppl_no,
        company_hier_id,
        suppl_edi_type_cd,
        suppl_sscc_cd,
        suppl_edi_status_cd,
        date_from,
        ROW_NUMBER() OVER (
            PARTITION BY suppl_no, company_hier_id
            ORDER BY date_from DESC, CASE WHEN suppl_edi_type_cd = 'A0' THEN 1 WHEN suppl_edi_type_cd = '40' then 2 ELSE 3 END
        ) AS rn
    FROM metro-bi-dl-${c.internal.toLowerCase()}-prod.cc_dwh.dw_suppl_am_co_per_info2 
)
SELECT
    suppl_no,
    company_hier_id,
    date_from,
    CASE
        WHEN suppl_sscc_cd = 1 THEN 'Sending SSCC'
        WHEN suppl_sscc_cd = 0 THEN 'Not sending SSCC'
        ELSE NULL
    END AS Supplier_SSCC,
    CASE
        WHEN suppl_edi_type_cd = 'A0' AND suppl_edi_status_cd = 'P' THEN 'EDI supplier:Delivery dispatch'
        WHEN suppl_edi_type_cd = '40' OR (suppl_edi_type_cd = 'A0' AND suppl_edi_status_cd <> 'P') THEN 'EDI supplier:Order dispatch'
        ELSE 'non-EDI supplier'
    END AS Suppliers_type
FROM LatestDates
WHERE rn = 1) b on a.Supplier_no=b.suppl_no and a.store_id=b.company_hier_id 
left join
(WITH pallets AS (
    SELECT
        art_no,
        tunit_no,
        tunits_pallet,
         date_from,date_to,
       ROW_NUMBER() OVER (
            PARTITION BY art_no, tunit_no
            ORDER BY date_from DESC
        ) AS rankx
    FROM metro-bi-dl-${c.internal.toLowerCase()}-prod.cc_dwh.dw_art_tu_per_info 
)
SELECT
     art_no,
        tunit_no,
        tunits_pallet,
         date_from, date_to
FROM pallets
WHERE rankx = 1) xx on a.article_no=xx.art_no and a.bundle_no=xx.tunit_no
LEFT JOIN
  (
    WITH
      bundles AS (
        SELECT
          art_no,
          tunit_no,
          tunit_qty,
          enter_date,
          ROW_NUMBER()
            OVER (
              PARTITION BY art_no, tunit_no
              ORDER BY enter_date DESC
            ) AS ranky
        FROM metro-bi-dl-${c.internal.toLowerCase()}-prod.cc_dwh.dw_art_tunit
      )
    SELECT
      art_no,
      tunit_no,
      tunit_qty
    FROM bundles
    WHERE ranky = 1
  ) yy
  ON a.article_no = yy.art_no AND a.bundle_no = yy.tunit_no
left join
(select g.*, h.MS_penetration_date from
(SELECT distinct countrycode,store_no, store_desc FROM metro-bi-wb-inventory-s00.customization.labels1  ) g 
left join
(SELECT Country,Store_no, MIN(Date) AS MS_penetration_date 
FROM
(SELECT Date,Store_no,Country,SUM(GR_count) AS ss
FROM metro-bi-wb-inventory-s00.Country_dashboards.gin_usage
where tool='MStore'
AND DATE(Date) >= ${date_filter_incremental}
GROUP BY Date, Store_no, Country) 
WHERE  ss > 1
GROUP BY  Country, Store_no) h
on  g.countryCode = h.Country  and g.store_no = h.Store_no) c on a.country=c.countrycode and a.store_no=c.store_no
left join
(select * from metro-bi-wb-inventory-s00.customization.Supplier_type) d   on a.Country=d.country_code and a.Supplier_no=d.supplier_number
left join 
(select e.*, f.MS_integration_date from
(SELECT distinct Country,GR_Type_no,GR_Type_name FROM metro-bi-wb-inventory-s00.Country_dashboards.gin_usage where DATE(Date) >= ${date_filter_incremental}) e 
left join
(SELECT Country,GR_Type_no, MIN(Date) AS MS_integration_date 
FROM
(SELECT Date,GR_Type_no,Country,SUM(GR_count) AS ss
FROM metro-bi-wb-inventory-s00.Country_dashboards.gin_usage
where tool='MStore'
and DATE(Date) >= ${date_filter_incremental}
GROUP BY Date, GR_Type_no, Country) 
WHERE  ss > 1
GROUP BY  Country, GR_Type_no) f
on  e.Country = f.Country  and e.GR_Type_no = f.GR_Type_no) m on a.Country=m.Country and a.GR_Type_no=m.GR_Type_no
`

module.exports = {
    gin_operational_XX
};
