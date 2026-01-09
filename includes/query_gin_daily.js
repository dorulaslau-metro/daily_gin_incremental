const {
    countries
} = require("../includes/countries");

const date_filter_incremental = `DATE_SUB(CURRENT_DATE('Europe/Bucharest'),INTERVAL 3 DAY)`;

/**
 * --------------------------------------------------------------------------
 * Dynamic builders for gin_daily
 * --------------------------------------------------------------------------
 */

/**
 * Build the per-country SELECT block used in gin_usage (the part that reads the
 * summarized info from Country_dashboards.gin_operational_XX).
 */
const buildCountryBlockGinDaily = (c) => `
SELECT
  xx.*,
  zz.Pallets_w_SSCC,
  zz.Pallets_mixed_w_SSCC,
  zz.Pallets_mixed_w_SSCC_art_sum,
  yy.DN_detail_ct,
  yy.DN_lines_ct
FROM
  (
    SELECT
      a.Date,
      a.storeNumber,
      a.Country,
      a.SSCC,
      c.GR_length_categ,
      CONCAT(LPAD(CAST(a.storeNumber AS STRING), 2, '0'), '. ', d.store_desc)
        AS Store_name,
      COUNT(DISTINCT a.goodsInboundId) AS GR_ct,
      SUM(a.GR_lines_ct) AS GR_lines_ct,
      AVG(c.difference_in_seconds) AS GR_time_avg,
      AVG(IF(a.SSCC = 'with SSCC', c.difference_in_seconds, NULL))
        AS GR_time_avg_w_SSCC,
      AVG(IF(a.SSCC = 'without SSCC', c.difference_in_seconds, NULL))
        AS GR_time_avg_wo_SSCC,
      AVG(
        IF(
          c.GR_length_categ = 'GR_time_avg_less_than_1h'
            AND a.SSCC = 'with SSCC',
          c.difference_in_seconds,
          NULL)) AS GR_time_avg_less_than_1h_w_SSCC,
      AVG(
        IF(
          c.GR_length_categ = 'GR_time_avg_more_than_1d'
            AND a.SSCC = 'with SSCC',
          c.difference_in_seconds,
          NULL)) AS GR_time_avg_more_than_1d_w_SSCC,
      AVG(
        IF(
          c.GR_length_categ = 'GR_time_avg_between_1h_1d'
            AND a.SSCC = 'with SSCC',
          c.difference_in_seconds,
          NULL)) AS GR_time_avg_between_1h_1d_w_SSCC,
      AVG(
        IF(
          c.GR_length_categ = 'GR_time_avg_less_than_1h'
            AND a.SSCC = 'without SSCC',
          c.difference_in_seconds,
          NULL)) AS GR_time_avg_less_than_1h_wo_SSCC,
      AVG(
        IF(
          c.GR_length_categ = 'GR_time_avg_more_than_1d'
            AND a.SSCC = 'without SSCC',
          c.difference_in_seconds,
          NULL)) AS GR_time_avg_more_than_1d_wo_SSCC,
      AVG(
        IF(
          c.GR_length_categ = 'GR_time_avg_between_1h_1d'
            AND a.SSCC = 'without SSCC',
          c.difference_in_seconds,
          NULL)) AS GR_time_avg_between_1h_1d_wo_SSCC,
      AVG(
        IF(
          c.GR_length_categ = 'GR_time_avg_less_than_1h',
          c.difference_in_seconds,
          NULL)) AS GR_time_avg_less_than_1h,
      AVG(
        IF(
          c.GR_length_categ = 'GR_time_avg_more_than_1d',
          c.difference_in_seconds,
          NULL)) AS GR_time_avg_more_than_1d,
      AVG(
        IF(
          c.GR_length_categ = 'GR_time_avg_between_1h_1d',
          c.difference_in_seconds,
          NULL)) AS GR_time_avg_between_1h_1d,
      COUNT(DISTINCT a.creationUser) AS GR_active_users_ct,
      SUM(IF(a.SSCC = 'with SSCC', a.GR_lines_ct, 0)) AS GR_lines_w_SSCC,
      SUM(IF(a.SSCC = 'without SSCC', a.GR_lines_ct, 0)) AS GR_lines_wo_SSCC,
      COUNT(DISTINCT a.originalSupplierNumber) AS GR_suppliers,
      COUNT(DISTINCT IF(a.SSCC = 'with SSCC', a.originalSupplierNumber, NULL))
        AS GR_suppliers_w_SSCC,
      COUNT(
        DISTINCT IF(a.SSCC = 'without SSCC', a.originalSupplierNumber, NULL))
        AS GR_suppliers_wo_SSCC,
      COALESCE(SUM(b.article_count_with_multiple_dates), 0)
        AS GR_art_w_muliple_bbd_ct,
      COALESCE(SUM(b.article_count_bestBeforeDate_sum), 0)
        AS GR_art_w_muliple_bbds_sum,
    FROM
      (
        SELECT
          DATE(creationDate) AS Date,
          storeNumber,
          countrycode AS Country,
          goodsInboundId,
          COUNT(DISTINCT subsystemArticleNumber) AS GR_lines_ct,
          creationUser,
          IF(serialShippingContainerCode <> '0', 'with SSCC', 'without SSCC')
            AS SSCC,
          originalSupplierNumber
        FROM metro-bi-dl-${c.internal.toLowerCase()}-prod.ingest_inventory.goods_inbound_articles
        WHERE
          creationUser <> 'AutoCompletionProcess'
          AND creationUser NOT LIKE '%metro.digital%'
          AND DATE(creationDate) >= DATE '2023-01-01'
          AND mmsExportStatus = 'CLOSED'
          ---- 20251219 Doru: added filter for 12 months fresh data on partitiontime to reduce data scanned
          AND DATE(PARTITIONTIME) >= ${date_filter_incremental}
        GROUP BY 1, 2, 3, 4, 6, 7, 8
      ) a
    LEFT JOIN
      (
        SELECT
          goodsInboundId,
          COUNT(subsystemArticleNumber) AS article_count_with_multiple_dates,
          sum(bestBeforeDate_count) AS article_count_bestBeforeDate_sum
        FROM
          (
            SELECT
              goodsInboundId,
              subsystemArticleNumber,
              COUNT(DISTINCT bestBeforeDate) AS bestBeforeDate_count
            FROM metro-bi-dl-${c.internal.toLowerCase()}-prod.ingest_inventory.goods_inbound_articles
            ---- 20251219 Doru: added filter for 12 months fresh data on partitiontime to reduce data scanned
            WHERE
              DATE(PARTITIONTIME) >= ${date_filter_incremental}
            GROUP BY goodsInboundId, subsystemArticleNumber
            HAVING COUNT(DISTINCT bestBeforeDate) > 1
          ) subquery
        GROUP BY goodsInboundId
      ) b
      ON a.goodsInboundId = b.goodsInboundId
    LEFT JOIN
      (
        SELECT
          goodsInboundId,
          TIMESTAMP_DIFF(
            MAX(TIMESTAMP(finalizationTime)),
            MIN(TIMESTAMP(initialScanTime)),
            SECOND) AS difference_in_seconds,
          CASE
            WHEN
              TIMESTAMP_DIFF(
                MAX(TIMESTAMP(finalizationTime)),
                MIN(TIMESTAMP(initialScanTime)),
                SECOND)
              < 3600
              THEN 'GR_time_avg_less_than_1h'
            WHEN
              TIMESTAMP_DIFF(
                MAX(TIMESTAMP(finalizationTime)),
                MIN(TIMESTAMP(initialScanTime)),
                SECOND)
              > 86400
              THEN 'GR_time_avg_more_than_1d'
            ELSE 'GR_time_avg_between_1h_1d'
            END AS GR_length_categ
        FROM metro-bi-dl-${c.internal.toLowerCase()}-prod.ingest_inventory.scan_process
        WHERE
          goodsInboundId IS NOT NULL
          AND DATE(PARTITIONTIME) >= ${date_filter_incremental}
        GROUP BY goodsInboundId
      ) c
      ON a.goodsInboundId = c.goodsInboundId
    LEFT JOIN
      (
        SELECT DISTINCT
          countrycode,
          store_no,
          store_desc
        FROM metro-bi-wb-inventory-s00.customization.labels1
      ) d
      ON a.Country = d.countrycode AND a.storeNumber = d.store_no
    GROUP BY
      a.Date, a.storeNumber, a.Country, a.SSCC, c.GR_length_categ, Store_name
  ) xx
LEFT JOIN
  (
    SELECT
      SUM(IF(e.detailedCheckStatus = 'CHECKED', e.DN_detail_ct, 0))
        AS DN_detail_ct,
      e.Date,
      e.countrycode,
      e.storenumber,
      SUM(e.DN_detail_ct) AS DN_lines_ct,
    FROM
      (
        SELECT DISTINCT
          countrycode,
          storeNumber,
          detailedCheckStatus,
          DATE(creationDate) AS Date,
          COUNT(DISTINCT subsystemArticleNumber) AS DN_detail_ct
        FROM metro-bi-dl-${c.internal.toLowerCase()}-prod.ingest_inventory.delivery_note_pallet_articles
        ---- 20251219 Doru: added filter for 12 months fresh data on partitiontime to reduce data scanned
        WHERE DATE(PARTITIONTIME) >= ${date_filter_incremental}
        GROUP BY 1, 2, 3, 4
      ) e
    GROUP BY e.Date, e.storeNumber, e.countrycode
  ) yy
  ON
    xx.Country = yy.countrycode
    AND xx.storeNumber = yy.storeNumber
    AND xx.Date = yy.Date
LEFT JOIN
  (
    SELECT
      COALESCE(SUM(f.SSCC_mixed_pallets_ct), 0) AS Pallets_mixed_w_SSCC,
      COALESCE(SUM(f.SSCC_pallets_ct), 0) AS Pallets_w_SSCC,
      COALESCE(SUM(f.SSCC_mixed_pallets_art_sum), 0)
        AS Pallets_mixed_w_SSCC_art_sum,
      f.countrycode,
      f.storeNumber,
      f.Date
    FROM
      (
        SELECT DISTINCT
          countrycode,
          storeNumber,
          Date,
          COUNT(DISTINCT palletid) AS SSCC_pallets_ct,
          COUNT(
            DISTINCT
              CASE
                WHEN subsystemArticleNumber_count > 1 THEN palletid
                ELSE NULL
                END) AS SSCC_mixed_pallets_ct,
          SUM(
            CASE
              WHEN subsystemArticleNumber_count > 1
                THEN subsystemArticleNumber_count
              ELSE NULL
              END) AS SSCC_mixed_pallets_art_sum
        FROM
          (
            SELECT
              countrycode,
              storeNumber,
              DATE(creationDate) AS Date,
              palletid,
              COUNT(DISTINCT subsystemArticleNumber)
                AS subsystemArticleNumber_count,
            FROM metro-bi-dl-${c.internal.toLowerCase()}-prod.ingest_inventory.delivery_note_pallet_articles
            WHERE
              serialShippingContainerCode <> '0'
              ---- 20251219 Doru: added filter for 12 months fresh data on partitiontime to reduce data scanned
              AND DATE(PARTITIONTIME) >= ${date_filter_incremental}
            GROUP BY countrycode, storeNumber, DATE(creationDate), palletid
          ) subq
        GROUP BY 1, 2, 3
      ) f
    GROUP BY f.Date, f.storeNumber, f.countrycode
  ) zz
  ON
    xx.Country = zz.countrycode
    AND xx.storeNumber = zz.storeNumber
    AND xx.Date = zz.Date
`;

/**
 * Build the full gin_usage query string.
 */
const buildGinDaily = (countries) => `
  ${countries.map((c) => `(${buildCountryBlockGinDaily(c)})`).join("\nUNION ALL\n")}
`;

/**
 * The final, dynamically-generated gin_usage string (evaluated at module load).
 * If you later want to exclude a country at runtime, filter the list before calling buildGinUsage.
 */
const gin_daily = buildGinDaily(countries);

module.exports = {
    gin_daily
};
