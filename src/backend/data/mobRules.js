// Data sourced from the "Flee, Mortals!" SRD, which appears to match the user's intent for mob combat.
const mobAttackResults = [
    { rollNeeded: 2, hitsPer4: 1, hitsPer5: 1, hitsPer6: 1, hitsPer8: 2, hitsPer10: 2 },
    { rollNeeded: 3, hitsPer4: 1, hitsPer5: 1, hitsPer6: 2, hitsPer8: 2, hitsPer10: 3 },
    { rollNeeded: 4, hitsPer4: 1, hitsPer5: 2, hitsPer6: 2, hitsPer8: 3, hitsPer10: 3 },
    { rollNeeded: 5, hitsPer4: 2, hitsPer5: 2, hitsPer6: 3, hitsPer8: 4, hitsPer10: 5 },
    { rollNeeded: 6, hitsPer4: 2, hitsPer5: 3, hitsPer6: 3, hitsPer8: 5, hitsPer10: 6 },
    { rollNeeded: 7, hitsPer4: 2, hitsPer5: 3, hitsPer6: 4, hitsPer8: 5, hitsPer10: 7 },
    { rollNeeded: 8, hitsPer4: 3, hitsPer5: 4, hitsPer6: 4, hitsPer8: 6, hitsPer10: 8 },
    { rollNeeded: 9, hitsPer4: 3, hitsPer5: 4, hitsPer6: 5, hitsPer8: 7, hitsPer10: 8 },
    { rollNeeded: 10, hitsPer4: 3, hitsPer5: 4, hitsPer6: 5, hitsPer8: 7, hitsPer10: 9 },
    { rollNeeded: 11, hitsPer4: 4, hitsPer5: 5, hitsPer6: 6, hitsPer8: 8, hitsPer10: 10 },
    { rollNeeded: 12, hitsPer4: 4, hitsPer5: 5, hitsPer6: 6, hitsPer8: 8, hitsPer10: 10 },
    { rollNeeded: 13, hitsPer4: 4, hitsPer5: 5, hitsPer6: 5, hitsPer8: 7, hitsPer10: 9 },
    { rollNeeded: 14, hitsPer4: 3, hitsPer5: 4, hitsPer6: 5, hitsPer8: 6, hitsPer10: 8 },
    { rollNeeded: 15, hitsPer4: 3, hitsPer5: 4, hitsPer6: 4, hitsPer8: 6, hitsPer10: 7 },
    { rollNeeded: 16, hitsPer4: 2, hitsPer5: 3, hitsPer6: 3, hitsPer8: 5, hitsPer10: 6 },
    { rollNeeded: 17, hitsPer4: 2, hitsPer5: 2, hitsPer6: 3, hitsPer8: 4, hitsPer10: 5 },
    { rollNeeded: 18, hitsPer4: 1, hitsPer5: 2, hitsPer6: 2, hitsPer8: 3, hitsPer10: 3 },
    { rollNeeded: 19, hitsPer4: 1, hitsPer5: 1, hitsPer6: 2, hitsPer8: 2, hitsPer10: 2 },
    { rollNeeded: 20, hitsPer4: 1, hitsPer5: 1, hitsPer6: 1, hitsPer8: 1, hitsPer10: 1 }
];

const areaTargets = [
    { targets: 1,  cone: '10-foot',         cube: '5- to 10-foot',  circular: '5-foot-radius',  line: '—' },
    { targets: 2,  cone: '15- to 20-foot',  cube: '15-foot',        circular: '—',                line: '30-foot-long, 5-foot-wide' },
    { targets: 3,  cone: '25-foot',         cube: '—',              circular: '10-foot-radius', line: '30-foot-long, 10-foot-wide or 60-foot-long, 5-foot-wide' },
    { targets: 4,  cone: '—',               cube: '20-foot',        circular: '—',                line: '90- or 100-foot-long, 5-foot-wide' },
    { targets: 5,  cone: '30-foot',         cube: '—',              circular: '—',                line: '60-foot-long, 10-foot-wide or 120-foot-long, 5-foot-wide' },
    { targets: 6,  cone: '35-foot',         cube: '25-foot',        circular: '15-foot-radius', line: '—' },
    { targets: 8,  cone: '40-foot',         cube: '30-foot',        circular: '—',                line: '90- or 100-foot-long, 10-foot-wide' },
    { targets: 9,  cone: '45-foot',         cube: '—',              circular: '—',                line: '—' },
    { targets: 10, cone: '50-foot',         cube: '35-foot',        circular: '20-foot-radius', line: '120-foot-long, 10-foot-wide' },
    { targets: 12, cone: '55-foot',         cube: '40-foot',        circular: '—',                line: '—' },
    { targets: 16, cone: '60-foot',         cube: '45-foot',        circular: '25-foot-radius', line: '—' },
    { targets: 20, cone: '—',               cube: '50-foot',        circular: '30-foot-radius', line: '—' }
];

module.exports = { mobAttackResults, areaTargets };