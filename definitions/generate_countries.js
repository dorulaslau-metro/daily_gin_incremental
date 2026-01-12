// 2026-01-12 Doru Laslau: Changed for incremental (vs full load) is by
// filtering all queries to only show data as per const date_filter_incremental 
// can change incremental update scope by changing this variable in file "../includes/incremental_filter.js"
//
// To ensure data consistency, in preOperations for each table we delete all data in the scope updated by the
// coresponding query and also delete all data older than 12 MONTHS. 
// ONLY CHANGE incremental update scope by changing variable value in file "../includes/incremental_filter.js". 

const schema_name = "temp_orchestration";
const {date_filter_incremental} = require("../includes/incremental_filter");
const {countries} = require("../includes/countries");

const {gin_operational_XX} = require("../includes/queries_gin_operational");
// plan to create a one step creation for GIN operational already unioned to support reporting and
// simplify downstream operations
// const {gin_operational_total} = require("../includes/query_gin_operational_total");
const {gin_usage} = require("../includes/query_gin_usage");
const {gin_daily} = require("../includes/query_gin_daily");
// const {gin_operational_all_in_one} = require("../includes/query_gin_operational_all_in_one");

countries.forEach((c) => {
    publish(`gin_operational_${c.iso2}`, {
        type: "incremental",
        schema: schema_name,
        bigquery: {
            partitionBy: "Date",
            clusterBy: ["Store_name", "GR_type_name","Tool","is_platform"]
        } ,
        tags: ["gin_operational"],
        preOperations: [
            `DELETE metro-bi-wb-inventory-s00.${schema_name}.gin_operational_${c.iso2}
            WHERE DATE >= ${date_filter_incremental} 
            OR
            DATE < DATE_SUB(CURRENT_DATE('Europe/Bucharest'), INTERVAL 12 MONTH) 
            `
        ]
    }).query(gin_operational_XX(c));
});

// publish("gin_operational", {
//         type: "incremental",
//         schema: schema_name,
        // bigquery: {
        //     partitionBy: "Date",
        //     clusterBy: ["Country", "Store_no","Tool","GR_Creation_source"]
        // } ,
//         // dependencies: countries.map(c => `gin_operational_${c.iso2}`),
//         preOperations: [
//             `DELETE metro-bi-wb-inventory-s00.${schema_name}.gin_operational
//             WHERE DATE >= ${date_filter_incremental} 
//             OR
//             DATE < DATE_SUB(CURRENT_DATE('Europe/Bucharest'), INTERVAL 12 MONTH)`
//         ]
//         ,
//         tags: ["gin_operational_total"]
//     }).query(gin_operational_total);


    publish("gin_usage", {
        type: "incremental",
        schema: schema_name,
        bigquery: {
            partitionBy: "Date",
            clusterBy: ["Country", "Store_name", "GR_type_name","Tool"]
        } ,
        preOperations: [
            `DELETE metro-bi-wb-inventory-s00.${schema_name}.gin_usage
            WHERE DATE >= ${date_filter_incremental} 
            OR
            DATE < DATE_SUB(CURRENT_DATE('Europe/Bucharest'), INTERVAL 12 MONTH)`
        ]
        ,
        tags: ["gin_usage"]
    }).query(gin_usage);

    publish("gin_daily", {
        type: "incremental",
        schema: schema_name,
        // not partitioning and clustering as the resulting table is very small (~40MB)
        // bigquery: {
        //     partitionBy: "Date",
        //     clusterBy: ["Country", "Store_name", "GR_type_name","Tool"]
        // } ,
        preOperations: [
            `DELETE metro-bi-wb-inventory-s00.${schema_name}.gin_daily
            WHERE DATE >= ${date_filter_incremental} 
            OR
            DATE < DATE_SUB(CURRENT_DATE('Europe/Bucharest'), INTERVAL 12 MONTH)`
        ]
        ,
        tags: ["gin_daily"]
    }).query(gin_daily);