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
        // preOperations: [
        //     `DROP TABLE metro-bi-wb-inventory-s00.Country_dashboards.gin_operational_${c.iso2}`
        // ]
    }).query(gin_operational_XX(c));

});
