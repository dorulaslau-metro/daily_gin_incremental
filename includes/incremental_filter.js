// 2026-01-12 Doru Laslau: Sets incremental filter date scope to be used throughout the project
// can change scope by changing this variable in file below. Eg: "..INTERVAL 1 MONTH)" etc...

const date_filter_incremental = `DATE_SUB(CURRENT_DATE('Europe/Bucharest'), INTERVAL 3 DAY)`

module.exports = {
    date_filter_incremental
};