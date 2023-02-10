// percent 0.0 = oldColour, percent 1.0 = newColour
export function mixColours(oldColour: number, newColour: number, percent: number) {
    percent = Math.min(1, percent);
    let oldR = oldColour >> 16 & 0xFF;
    let oldG = oldColour >> 8  & 0xFF;
    let oldB = oldColour       & 0xFF;
    let newR = newColour >> 16 & 0xFF;
    let newG = newColour >> 8  & 0xFF;
    let newB = newColour       & 0xFF;
    let mixR = oldR * (1 - percent) + newR * percent;
    let mixG = oldG * (1 - percent) + newG * percent;
    let mixB = oldB * (1 - percent) + newB * percent;
    return mixR << 16 | mixG << 8 | mixB;
}

export function intToHex(num: number, pad = 6) {
    return '#' + num.toString(16).padStart(pad, "0");
}
