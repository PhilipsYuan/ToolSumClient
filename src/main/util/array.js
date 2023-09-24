/**
 * 将数组分拆成多个数组
 * @param array 原数组
 * @param subGroupLength 拆分的每组的数量。
 * @returns {*[]}
 */
export function splitArray(array, subGroupLength) {
    let index = 0;
    let newArray = [];
    while (index < array.length) {
        newArray.push(array.slice(index, index += subGroupLength));
    }
    return newArray;
}