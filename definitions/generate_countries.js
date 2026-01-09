const schema_name = "temp_orchestration";
const {countries} = require("../includes/countries");
const {
    gin_operational_XX, gin_usage
} = require("../includes/queries_dynamic");

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
    }).query(gin_operational_XX(c));
});

    publish("gin_usage", {
        type: "incremental",
        schema: schema_name,
        dependencies: countries.map(c => `gin_operational_${c.iso2}`),
        preOperations: [
            `DELETE metro-bi-wb-inventory-s00.${schema_name}.gin_usage
            where DATE >= DATE_SUB(CURRENT_DATE('Europe/Bucharest'),INTERVAL 3 DAY)`
        ]
    }).query(gin_usage);