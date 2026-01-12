// 2026-01-12 Doru Laslau: Changed for incremental (vs full load) is by:
// filtering: 
//
//   metro-bi-wb-inventory-s00.Country_dashboards.gin_operational_XX
//
// to only show data as per const date_filter_incremental 
// can change incremental update scope by changing this variable in file "../includes/incremental_filter.js"

const { date_filter_incremental } = require("../includes/incremental_filter")
const { countries } = require("../includes/countries");
const {dataset_name} = require("../includes/dataset");
/**
 * --------------------------------------------------------------------------
 * Dynamic builders for gin_usage
 * --------------------------------------------------------------------------
 */

/**
 * Build the per-country SELECT block used in gin_usage (the part that reads the
 * summarized info from Country_dashboards.gin_operational_XX).
 */
const buildCountryBlockGinUsage = (iso2) => `
SELECT
  COUNT(DISTINCT Supplier_no) AS Supplier_count,
  COUNT(DISTINCT GR_PK)       AS GR_count,
  COUNT(Article_PK)           AS Article_count,
  Store_name,
  GR_Type_name,
  GR_types_Integration,
  Stores_Penetration,
  Country,
  Date,
  Validation_Date,
  Store_no,
  Data_source,
  Tool,
  GR_Type_no,
  GR_Creation_Source,
  Suppliers_type,
  Supplier_SSCC,
  is_platform,
  SUM(GoodsReceiving_quantity) AS GoodsReceiving_quantity,
  SUM(GoodsReceiving_quantity / NULLIF(tunits_pallet, 0)) AS Pallet_sum,
  AVG(GoodsReceiving_quantity / NULLIF(tunits_pallet, 0)) AS Pallet_avg,
  SUM(Order_quantity)         AS Order_quantity,
  SUM(DeliveryNote_quantity)  AS DeliveryNote_quantity,
  COUNT(
    DISTINCT (
      CASE
        WHEN tunits_pallet IS NULL OR tunits_pallet = 0 THEN Article_id
        ELSE NULL
      END
    )
  ) / COUNT(DISTINCT Article_id) AS Missing_pallet_info
FROM metro-bi-wb-inventory-s00.${dataset_name}.gin_operational_${iso2}
WHERE DATE(Date) >= ${date_filter_incremental}
GROUP BY
  Store_name, GR_Type_name, GR_types_Integration, Stores_Penetration,
  Country, Date, Validation_Date, Store_no, Data_source, Tool,
  GR_Type_no, GR_Creation_Source, Suppliers_type, Supplier_SSCC, is_platform
`;

/**
 * Build the LEFT JOIN store status UNION ALL from the same countries list.
 * Matches the original patterns:
 *   metro-bi-dl-<internal-lower>-prod.ingest_inventory.goods_receiving_stores
 */
const buildStoresStatusUnionGinUsage = (countries) =>
  countries
    .map(
      (c) => `
SELECT DISTINCT
  CAST(storenumber AS INT64) AS store_no,
  status,
  countrycode
FROM metro-bi-dl-${c.internal.toLowerCase()}-prod.ingest_inventory.goods_receiving_stores`.trim()
    )
    .join("\nUNION ALL\n");

/**
 * Build the full gin_usage query string.
 */
const buildGinUsage = (countries) => `
SELECT a.*, b.status AS Store_status
FROM (
  ${countries.map((c) => `(${buildCountryBlockGinUsage(c.iso2)})`).join("\nUNION ALL\n")}
) a
LEFT JOIN (
  ${buildStoresStatusUnionGinUsage(countries)}
) b
ON a.Country = b.countrycode AND a.Store_no = b.store_no
`;

/**
 * The final, dynamically-generated gin_usage string (evaluated at module load).
 * If you later want to exclude a country at runtime, filter the list before calling buildGinUsage.
 */
const gin_usage = buildGinUsage(countries);

module.exports = {
    gin_usage
};
