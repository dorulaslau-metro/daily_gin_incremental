const schema_name = "temp_orchestration";
const {countries} = require("../includes/countries");
const {gin_operational_XX} = require("../includes/queries_gin_operational");
const {gin_usage} = require("../includes/query_gin_usage");
const {gin_daily} = require("../includes/query_gin_daily");

countries.forEach((c) => {
    publish(`gin_operational_${c.iso2}`, {
        type: "incremental",
        schema: schema_name,
        bigquery: {
            partitionBy: "Date",
        }
        ,
        preOperations: [
            `DELETE metro-bi-wb-inventory-s00.${schema_name}.gin_operational_${c.iso2}
            where DATE >= DATE_SUB(CURRENT_DATE('Europe/Bucharest'),INTERVAL 3 DAY)`
        ]
        ,
        tags: ["gin_operational"]
    }).query(gin_operational_XX(c));
});

    publish("gin_usage", {
        type: "incremental",
        schema: schema_name,
        //dependencies: countries.map(c => `gin_operational_${c.iso2}`),
        preOperations: [
            `DELETE metro-bi-wb-inventory-s00.${schema_name}.gin_usage
            where DATE >= DATE_SUB(CURRENT_DATE('Europe/Bucharest'),INTERVAL 3 DAY)`
        ]
        ,
        tags: ["gin_usage"]
    }).query(gin_usage);

    publish("gin_daily", {
        type: "incremental",
        schema: schema_name,
        //dependencies: countries.map(c => `gin_operational_${c.iso2}`),
        preOperations: [
            `DELETE metro-bi-wb-inventory-s00.${schema_name}.gin_daily
            where DATE >= DATE_SUB(CURRENT_DATE('Europe/Bucharest'),INTERVAL 3 DAY)`
        ]
        ,
        tags: ["gin_daily"]
    }).query(gin_daily);