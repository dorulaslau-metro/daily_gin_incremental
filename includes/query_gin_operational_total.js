// 2026-01-12 Doru Laslau: Union ALL of all the gin_operational_XX tables to streamline dashboard usage:
// can change incremental update scope by changing this variable in file "../includes/incremental_filter.js"

const { date_filter_incremental } = require("../includes/incremental_filter")
const { countries } = require("../includes/countries");


const buildCountryBlockGinOperational = (iso2) => `
SELECT *
FROM metro-bi-wb-inventory-s00.Country_dashboards.gin_operational_${iso2}
WHERE DATE(Date) >= ${date_filter_incremental}
`;

const buildGinOperationalTotal = (countries) => `
SELECT a.*
FROM (
  ${countries.map((c) => `(${buildCountryBlockGinOperational(c.iso2)})`).join("\nUNION ALL\n")}
) a
`;

const gin_operational_total = buildGinOperationalTotal(countries);

module.exports = {
    gin_operational_total
};
