const ExcelJS = require('exceljs');
const fs = require('fs');

async function test() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('/Users/akashdeep/Downloads/Catalogue-178091177747140.xlsx');
  const worksheet = workbook.worksheets[0];

  const headerRow = worksheet.getRow(1);
  const headers = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = cell.text.trim();
  });

  const colImg = headers.findIndex(h => h === 'Product Image' || h === 'Image');
  console.log('Headers:', headers);
  console.log('colImg:', colImg);

  const cellImages = new Map();
  for (const image of worksheet.getImages()) {
    const row = Math.floor(image.range.tl.nativeRow);
    const col = Math.floor(image.range.tl.nativeCol);
    console.log(`Image found at nativeRow: ${row}, nativeCol: ${col}`);
  }
}
test();
