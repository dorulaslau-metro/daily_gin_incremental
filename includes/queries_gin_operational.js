// 2026-01-12 Doru Laslau: Changed for incremental (vs full load) is by:
// filtering: 
//
//   metro-bi-dl-XX-prod.ingest_mmsstore_stgr.mw_kpi_goods_receiving
//
// to only show data as per const date_filter_incremental 
// can change incremental update scope by changing this variable in file "../includes/incremental_filter.js"
const {dataset_name} = require("../includes/dataset");
const {date_filter_incremental} = require("../includes/incremental_filter")

const gin_operational_XX = (c) => `
SELECT
  a.*,
  b.Suppliers_type,
  b.Supplier_SSCC,
  b.date_from AS SSCC_status_date_from,
  CONCAT(a.Store_no, '. ', c.store_desc) AS Store_name,
  d.is_platform,
  d.supplier_name,
  d.eng_supplier_name_without_special_characters,
  (
    CASE
      WHEN a.Date > c.MS_penetration_date THEN 'Stores activated in MStore'
      ELSE 'Stores active only in MMS'
      END) AS Stores_Penetration,
  (
    CASE
      WHEN a.Date > m.MS_integration_date THEN 'GR types available in MStore'
      ELSE 'GR types available only in MMS'
      END) AS GR_types_Integration,
  xx.tunit_no,
  xx.tunits_pallet,
  xx.date_from,
  xx.date_to,
  yy.tunit_qty
FROM
  (
    SELECT
      gr_no,
      gr_id,
      CONCAT(gr_no, store_no) AS GR_PK,
      gr_id AS GR_FK,
      CONCAT(
        gr_no, store_no, (article_no * 1000000 + variant * 1000 + bundle_no))
        AS Article_PK,
      '${c.iso2}' AS Country,
      CAST(SUBSTR(gr_creation_date, 1, 10) AS DATE FORMAT 'yyyy-mm-dd') AS Date,
      CAST(SUBSTR(gr_validation2_date, 1, 10) AS DATE FORMAT 'yyyy-mm-dd')
        AS Validation_Date,
      store_no AS Store_no,
      (CASE WHEN gr_creation_source = 5 THEN 'MStore' ELSE 'MMS' END) AS Tool,
      'mw_kpi_goods_receiving' AS Data_source,
      (
        CASE
          WHEN gr_creation_source = 1 THEN 'GR created manually in MMS ST'
          WHEN gr_creation_source = 2 THEN 'GR in MMS ST Mobile'
          WHEN gr_creation_source = 3 THEN 'SSCC GR MMS ST Mobile'
          WHEN gr_creation_source = 4
            THEN
              'GR automatically (including DESADV, IST from, GRs from 3PL, GRC from IC)'
          WHEN gr_creation_source = 5 THEN ' GR done in MStore GIN'
          ELSE NULL
          END) AS GR_Creation_source,
      gr_type AS GR_type_no,
      (
        CASE
          WHEN gr_type = 1 THEN '1. Pool GR'
          WHEN gr_type = 10 THEN '10. Transf. to Consignment'
          WHEN gr_type = 11 THEN '11. Transf. from Consignment'
          WHEN gr_type = 12 THEN '12. Credit/Debit note for Goods'
          WHEN gr_type = 14 THEN '14. GRC Consignment'
          WHEN gr_type = 15 THEN '15. Pool GR Consignment'
          WHEN gr_type = 17 THEN '17. Goods Issue'
          WHEN gr_type = 2 THEN '2. Manual GR'
          WHEN gr_type = 3 THEN '3. Transfer to'
          WHEN gr_type = 4 THEN '4. Transfer from'
          WHEN gr_type = 5 THEN '5. Return'
          WHEN gr_type = 6 THEN '6. GRC'
          WHEN gr_type = 7 THEN '7. Correction'
          WHEN gr_type = 8 THEN '8. Manual Consignment'
          WHEN gr_type = 9 THEN '9. Return Consignment'
          ELSE CAST(gr_type AS string) || ". Missing label"
          END) AS GR_type_name,
      (article_no * 1000000 + variant * 1000 + bundle_no) AS Article_id,
      article_no,
      bundle_no,
      gr_quantity AS GoodsReceiving_quantity,
      order_quantity AS Order_quantity,
      dn_quantity AS DeliveryNote_quantity,
      supplier_no AS Supplier_no,
      ls_no AS dn_no_fk,
      pos_no AS Position_no,
      store_id,
      PARTITIONTIME
    FROM
      (
        WITH
          ranked_mms AS (
            SELECT
              pkc.*,
              RANK()
                OVER (
                  PARTITION BY pkc.gr_no || pkc.store_no || pkc.article_no
                  ORDER BY dana_ingestion_timestamp DESC
                ) AS rank
            FROM
              metro-bi-dl-${c.internal.toLowerCase()}-prod.ingest_mmsstore_stgr.mw_kpi_goods_receiving
                pkc
            WHERE DATE(PARTITIONTIME) >= ${date_filter_incremental}
          )
        SELECT DISTINCT
          *
        FROM ranked_mms
        WHERE rank = 1
      )
    WHERE
      CAST(SUBSTR(gr_creation_date, 1, 10) AS DATE FORMAT 'yyyy-mm-dd')
      >= ${date_filter_incremental}
  ) a
LEFT JOIN
  (
    WITH
      LatestDates AS (
        SELECT
          suppl_no,
          company_hier_id,
          suppl_edi_type_cd,
          suppl_sscc_cd,
          suppl_edi_status_cd,
          date_from,
          ROW_NUMBER()
            OVER (
              PARTITION BY suppl_no, company_hier_id
              ORDER BY
                date_from DESC,
                CASE
                  WHEN suppl_edi_type_cd = 'A0' THEN 1
                  WHEN suppl_edi_type_cd = '40' THEN 2
                  ELSE 3
                  END
            ) AS rn
        FROM
          metro-bi-dl-${c.internal.toLowerCase()}-prod.cc_dwh.dw_suppl_am_co_per_info2
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
        WHEN suppl_edi_type_cd = 'A0' AND suppl_edi_status_cd = 'P'
          THEN 'EDI supplier:Delivery dispatch'
        WHEN
          suppl_edi_type_cd = '40'
          OR (suppl_edi_type_cd = 'A0' AND suppl_edi_status_cd <> 'P')
          THEN 'EDI supplier:Order dispatch'
        ELSE 'non-EDI supplier'
        END AS Suppliers_type
    FROM LatestDates
    WHERE rn = 1
  ) b
  ON a.Supplier_no = b.suppl_no AND a.store_id = b.company_hier_id
LEFT JOIN
  (
    WITH
      pallets AS (
        SELECT
          art_no,
          tunit_no,
          tunits_pallet,
          date_from,
          date_to,
          ROW_NUMBER()
            OVER (
              PARTITION BY art_no, tunit_no
              ORDER BY date_from DESC
            ) AS rankx
        FROM
          metro-bi-dl-${c.internal.toLowerCase()}-prod.cc_dwh.dw_art_tu_per_info
      )
    SELECT
      art_no,
      tunit_no,
      tunits_pallet,
      date_from,
      date_to
    FROM pallets
    WHERE rankx = 1
  ) xx
  ON a.article_no = xx.art_no AND a.bundle_no = xx.tunit_no
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
LEFT JOIN
  (
    SELECT g.*, h.MS_penetration_date
    FROM
      (
        SELECT DISTINCT countrycode, store_no, store_desc
        FROM metro-bi-wb-inventory-s00.customization.labels1
      ) g
    LEFT JOIN
      (
        SELECT Country, Store_no, MIN(Date) AS MS_penetration_date
        FROM
          (
            SELECT Date, Store_no, Country, SUM(GR_count) AS ss
            FROM metro-bi-wb-inventory-s00.${dataset_name}.gin_usage
            WHERE
              tool = 'MStore'
              AND DATE(Date) >= ${date_filter_incremental}
            GROUP BY Date, Store_no, Country
          )
        WHERE ss > 1
        GROUP BY Country, Store_no
      ) h
      ON g.countryCode = h.Country AND g.store_no = h.Store_no
  ) c
  ON a.country = c.countrycode AND a.store_no = c.store_no
LEFT JOIN
  (SELECT * FROM metro-bi-wb-inventory-s00.customization.Supplier_type) d
  ON a.Country = d.country_code AND a.Supplier_no = d.supplier_number
LEFT JOIN
  (
    SELECT e.*, f.MS_integration_date
    FROM
      (
        SELECT DISTINCT Country, GR_Type_no, GR_Type_name
        FROM metro-bi-wb-inventory-s00.${dataset_name}.gin_usage
        WHERE DATE(Date) >= ${date_filter_incremental}
      ) e
    LEFT JOIN
      (
        SELECT Country, GR_Type_no, MIN(Date) AS MS_integration_date
        FROM
          (
            SELECT Date, GR_Type_no, Country, SUM(GR_count) AS ss
            FROM metro-bi-wb-inventory-s00.${dataset_name}.gin_usage
            WHERE
              tool = 'MStore'
              AND DATE(Date) >= ${date_filter_incremental}
            GROUP BY Date, GR_Type_no, Country
          )
        WHERE ss > 1
        GROUP BY Country, GR_Type_no
      ) f
      ON e.Country = f.Country AND e.GR_Type_no = f.GR_Type_no
  ) m
  ON a.Country = m.Country AND a.GR_Type_no = m.GR_Type_no

`

module.exports = {
    gin_operational_XX
};
