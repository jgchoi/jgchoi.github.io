// Javascript
// Add row in table

function addRow(second) {
    // array of number from 1 to 15
    var arr1to15 = Array.from({length: 15}, (v, k) => k+1);
    var arr16to30 = Array.from({length: 15}, (v, k) => k+16);
    var arr31to45 = Array.from({length: 15}, (v, k) => k+31);
    var arr46to60 = Array.from({length: 15}, (v, k) => k+46);
    var arr61to75 = Array.from({length: 15}, (v, k) => k+61);
    
    // mix arry
    arr1to15.sort(() => Math.random() - 0.5);
    arr16to30.sort(() => Math.random() - 0.5);
    arr31to45.sort(() => Math.random() - 0.5);
    arr46to60.sort(() => Math.random() - 0.5);
    arr61to75.sort(() => Math.random() - 0.5);

    // generate row that consist of first element from arr1to15, arra16to30, arr31to45, arr46to60, arr61to75
    var row1 = [arr1to15[0], arr16to30[0], arr31to45[0], arr46to60[0], arr61to75[0]];
    var row2 = [arr1to15[1], arr16to30[1], arr31to45[1], arr46to60[1], arr61to75[1]];
    var row3 = [arr1to15[2], arr16to30[2], arr31to45[2], arr46to60[2], arr61to75[2]];
    var row4 = [arr1to15[3], arr16to30[3], arr31to45[3], arr46to60[3], arr61to75[3]];
    var row5 = [arr1to15[4], arr16to30[4], arr31to45[4], arr46to60[4], arr61to75[4]];

    var rows = [row1, row2, row3, row4, row5];
    if (second) {
        var table = document.getElementById("table2");
    } else {
        var table = document.getElementById("table");
    }
    
    for (var j = 0; j < 5; j++) {
        var row = table.insertRow(j+1);
        for (var i = 0; i < 5; i++) {
            var cell = row.insertCell(i);
            cell.innerHTML = rows[j][i];
            // set cell font to 20 and center
            cell.style.fontSize = "20px";
            cell.style.textAlign = "center";
            // width 200 height 200
            cell.style.width = "50px";
            cell.style.height = "50px";
        }
    }
}

addRow(true);
addRow(false);