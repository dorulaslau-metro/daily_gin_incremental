const { countries } = require("../includes/countries");
const { gin_operational_XX } = require("../includes/queries");

countries.forEach((c) => {
    publish(`gin_operational_${c.iso2}`, {
        type: "incremental", 
        schema: "temp_orchestration",
        bigquery: { 
            partitionBy: "Date",
            //requirePartitionFilter: true
        }
        // ,
        , preOperations: [
            `DELETE metro-bi-wb-inventory-s00.temp_orchestration.gin_operational_${c.iso2}
            where DATE >= DATE_SUB(CURRENT_DATE('Europe/Bucharest'),INTERVAL 3 DAY)`
        ]
    }).query(gin_operational_XX(c));

});
