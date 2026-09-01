export const INDUS_CAMPUS = {
    id: "indus-campus",
    name: "Indus University",
    address: "Rancharda, Via Shilaj, Ahmedabad - 382115",
    coordinates: [23.0652, 72.4402],
};

export const indusRoutes = [
    {
        id: "route-iu-r1",
        code: "IU-R1",
        name: "Maninagar - Indus University",
        busNumbers: ["8821"],
        primaryBusNumber: "8821",
        startPoint: "Aavkar Hall",
        destination: INDUS_CAMPUS.name,
        campusArrival: "8:35 AM",
        distance: "25.8 km",
        studentCount: 96,
        mapCenter: [23.027, 72.526],
        notes: "Coordinates are approximate for route visualization.",
        stops: [
            { id: "iu-r1-01", name: "Aavkar Hall", scheduledTime: "7:30 AM", coordinates: [22.9869, 72.6116] },
            { id: "iu-r1-02", name: "Maninagar Crossing", scheduledTime: "7:35 AM", coordinates: [22.9971, 72.6117] },
            { id: "iu-r1-03", name: "Maninagar Station", scheduledTime: "7:35 AM", coordinates: [22.9981, 72.6112] },
            { id: "iu-r1-04", name: "Rambaug", scheduledTime: "7:40 AM", coordinates: [23.0038, 72.6071] },
            { id: "iu-r1-05", name: "Kankaria", scheduledTime: "7:40 AM", coordinates: [23.0061, 72.6026] },
            { id: "iu-r1-06", name: "Football Ground", scheduledTime: "7:45 AM", coordinates: [23.0127, 72.5948] },
            { id: "iu-r1-07", name: "Bhulabhai", scheduledTime: "7:45 AM", coordinates: [23.0094, 72.5868] },
            { id: "iu-r1-08", name: "Geeta Mandir", scheduledTime: "7:50 AM", coordinates: [23.0157, 72.5891] },
            { id: "iu-r1-09", name: "NID", scheduledTime: "7:55 AM", coordinates: [23.0117, 72.5703] },
            { id: "iu-r1-10", name: "Paldi", scheduledTime: "7:55 AM", coordinates: [23.0122, 72.5625] },
            { id: "iu-r1-11", name: "Fatehpura", scheduledTime: "8:00 AM", coordinates: [23.0061, 72.5566] },
            { id: "iu-r1-12", name: "Anjali", scheduledTime: "8:00 AM", coordinates: [22.9969, 72.5507] },
            { id: "iu-r1-13", name: "Dharnidhar", scheduledTime: "8:05 AM", coordinates: [22.9996, 72.5442] },
            { id: "iu-r1-14", name: "Manekbaug", scheduledTime: "8:05 AM", coordinates: [23.0115, 72.5318] },
            { id: "iu-r1-15", name: "Shyammal", scheduledTime: "8:10 AM", coordinates: [23.0146, 72.5238] },
            { id: "iu-r1-16", name: "Keshavbaug", scheduledTime: "8:10 AM", coordinates: [23.0228, 72.5221] },
            { id: "iu-r1-17", name: "Mansi Tower", scheduledTime: "8:15 AM", coordinates: [23.0316, 72.5178] },
            { id: "iu-r1-18", name: "Judges Bunglow", scheduledTime: "8:15 AM", coordinates: [23.0342, 72.5152] },
            { id: "iu-r1-19", name: "Pakvaan", scheduledTime: "8:15 AM", coordinates: [23.0349, 72.5066] },
            { id: "iu-r1-20", name: INDUS_CAMPUS.name, scheduledTime: "8:35 AM", coordinates: INDUS_CAMPUS.coordinates },
        ],
    },
    {
        id: "route-iu-r2",
        code: "IU-R2",
        name: "Ishanpur - Bopal - Indus University",
        busNumbers: ["9220", "1489"],
        primaryBusNumber: "9220",
        startPoint: "Partheshwar",
        destination: INDUS_CAMPUS.name,
        campusArrival: "8:50 AM",
        distance: "29.4 km",
        studentCount: 124,
        mapCenter: [23.015, 72.505],
        notes: "Coordinates are approximate for route visualization.",
        stops: [
            { id: "iu-r2-01", name: "Partheshwar", scheduledTime: "7:30 AM", coordinates: [22.9771, 72.6043] },
            { id: "iu-r2-02", name: "Ishanpur", scheduledTime: "7:30 AM", coordinates: [22.9824, 72.6007] },
            { id: "iu-r2-03", name: "Ramvadi", scheduledTime: "7:35 AM", coordinates: [22.9868, 72.5952] },
            { id: "iu-r2-04", name: "Jaymala", scheduledTime: "7:35 AM", coordinates: [22.9934, 72.5894] },
            { id: "iu-r2-05", name: "Hirabhai Tower", scheduledTime: "7:40 AM", coordinates: [22.9969, 72.5808] },
            { id: "iu-r2-06", name: "Jawahar Chowk", scheduledTime: "7:45 AM", coordinates: [23.0011, 72.5728] },
            { id: "iu-r2-07", name: "Bhairavnath", scheduledTime: "7:45 AM", coordinates: [22.9991, 72.5664] },
            { id: "iu-r2-08", name: "Danilimda", scheduledTime: "7:50 AM", coordinates: [22.9976, 72.5769] },
            { id: "iu-r2-09", name: "Chandranagar", scheduledTime: "7:55 AM", coordinates: [22.9944, 72.5606] },
            { id: "iu-r2-10", name: "Anjali Crossroad", scheduledTime: "7:55 AM", coordinates: [22.9969, 72.5507] },
            { id: "iu-r2-11", name: "Vasna Bus Stand", scheduledTime: "8:00 AM", coordinates: [22.9995, 72.5401] },
            { id: "iu-r2-12", name: "Jivraj Mehta Hospital", scheduledTime: "8:00 AM", coordinates: [23.0034, 72.5365] },
            { id: "iu-r2-13", name: "Malav Talav", scheduledTime: "8:00 AM", coordinates: [23.0005, 72.5324] },
            { id: "iu-r2-14", name: "Jivraj Park", scheduledTime: "8:05 AM", coordinates: [23.0066, 72.5308] },
            { id: "iu-r2-15", name: "Shyammal", scheduledTime: "8:05 AM", coordinates: [23.0146, 72.5238] },
            { id: "iu-r2-16", name: "Sachin Tower", scheduledTime: "8:10 AM", coordinates: [23.0185, 72.5207] },
            { id: "iu-r2-17", name: "Anandnagar", scheduledTime: "8:10 AM", coordinates: [23.0261, 72.5116] },
            { id: "iu-r2-18", name: "Prernatirth Deraser", scheduledTime: "8:10 AM", coordinates: [23.0281, 72.5072] },
            { id: "iu-r2-19", name: "Star Bazar", scheduledTime: "8:15 AM", coordinates: [23.0309, 72.5091] },
            { id: "iu-r2-20", name: "Ramdevnagar", scheduledTime: "8:15 AM", coordinates: [23.0342, 72.5017] },
            { id: "iu-r2-21", name: "Iscon", scheduledTime: "8:20 AM", coordinates: [23.0309, 72.5034] },
            { id: "iu-r2-22", name: "Bopal", scheduledTime: "8:25 AM", coordinates: [23.0358, 72.4656] },
            { id: "iu-r2-23", name: INDUS_CAMPUS.name, scheduledTime: "8:50 AM", coordinates: INDUS_CAMPUS.coordinates },
        ],
    },
    {
        id: "route-iu-r3",
        code: "IU-R3",
        name: "Chandkheda - Science City - Indus University",
        busNumbers: ["3376"],
        primaryBusNumber: "3376",
        startPoint: "Icon Crossroad",
        destination: INDUS_CAMPUS.name,
        campusArrival: "8:30 AM",
        distance: "24.2 km",
        studentCount: 104,
        mapCenter: [23.091, 72.527],
        notes: "Coordinates are approximate for route visualization.",
        stops: [
            { id: "iu-r3-01", name: "Icon Crossroad", scheduledTime: "7:10 AM", coordinates: [23.1056, 72.6264] },
            { id: "iu-r3-02", name: "Godrej Garden City", scheduledTime: "7:15 AM", coordinates: [23.1195, 72.6102] },
            { id: "iu-r3-03", name: "Chandkheda", scheduledTime: "7:25 AM", coordinates: [23.1099, 72.5844] },
            { id: "iu-r3-04", name: "New CG Road", scheduledTime: "7:30 AM", coordinates: [23.1121, 72.5749] },
            { id: "iu-r3-05", name: "Visat Petrol Pump", scheduledTime: "7:30 AM", coordinates: [23.1005, 72.5812] },
            { id: "iu-r3-06", name: "Sabarmati", scheduledTime: "7:35 AM", coordinates: [23.0838, 72.5867] },
            { id: "iu-r3-07", name: "RTO", scheduledTime: "7:40 AM", coordinates: [23.0789, 72.5776] },
            { id: "iu-r3-08", name: "Vyaswadi", scheduledTime: "7:40 AM", coordinates: [23.0719, 72.5689] },
            { id: "iu-r3-09", name: "Akhbarnagar", scheduledTime: "7:45 AM", coordinates: [23.0716, 72.5593] },
            { id: "iu-r3-10", name: "Umiya Hall", scheduledTime: "7:50 AM", coordinates: [23.0703, 72.5501] },
            { id: "iu-r3-11", name: "Prabhat Chowk", scheduledTime: "7:55 AM", coordinates: [23.0673, 72.5441] },
            { id: "iu-r3-12", name: "Sola Road", scheduledTime: "8:00 AM", coordinates: [23.0697, 72.5324] },
            { id: "iu-r3-13", name: "Sola Bhagvat", scheduledTime: "8:00 AM", coordinates: [23.0762, 72.5229] },
            { id: "iu-r3-14", name: "Kargil Petrol Pump", scheduledTime: "8:05 AM", coordinates: [23.0794, 72.5165] },
            { id: "iu-r3-15", name: "Science City", scheduledTime: "8:10 AM", coordinates: [23.0806, 72.4957] },
            { id: "iu-r3-16", name: INDUS_CAMPUS.name, scheduledTime: "8:30 AM", coordinates: INDUS_CAMPUS.coordinates },
        ],
    },
    {
        id: "route-iu-r4",
        code: "IU-R4",
        name: "Akhbarnagar - Thaltej - Indus University",
        busNumbers: ["9468"],
        primaryBusNumber: "9468",
        startPoint: "Vyaswadi",
        destination: INDUS_CAMPUS.name,
        campusArrival: "8:40 AM",
        distance: "19.8 km",
        studentCount: 88,
        mapCenter: [23.067, 72.502],
        notes: "Coordinates are approximate for route visualization.",
        stops: [
            { id: "iu-r4-01", name: "Vyaswadi", scheduledTime: "7:50 AM", coordinates: [23.0719, 72.5689] },
            { id: "iu-r4-02", name: "Akhbarnagar", scheduledTime: "7:50 AM", coordinates: [23.0716, 72.5593] },
            { id: "iu-r4-03", name: "Umiya Hall", scheduledTime: "7:55 AM", coordinates: [23.0703, 72.5501] },
            { id: "iu-r4-04", name: "Sola Road", scheduledTime: "7:55 AM", coordinates: [23.0697, 72.5324] },
            { id: "iu-r4-05", name: "Prabhat Chowk", scheduledTime: "8:00 AM", coordinates: [23.0673, 72.5441] },
            { id: "iu-r4-06", name: "Pallav Crossroad", scheduledTime: "8:00 AM", coordinates: [23.0633, 72.5391] },
            { id: "iu-r4-07", name: "AEC Crossroad", scheduledTime: "8:05 AM", coordinates: [23.0617, 72.5307] },
            { id: "iu-r4-08", name: "Bhuyangdev", scheduledTime: "8:05 AM", coordinates: [23.0638, 72.5234] },
            { id: "iu-r4-09", name: "Surdhara Circle", scheduledTime: "8:10 AM", coordinates: [23.0645, 72.5169] },
            { id: "iu-r4-10", name: "SAL Hospital", scheduledTime: "8:10 AM", coordinates: [23.0631, 72.5089] },
            { id: "iu-r4-11", name: "Thaltej", scheduledTime: "8:15 AM", coordinates: [23.0501, 72.5022] },
            { id: "iu-r4-12", name: "Zydus Hospital", scheduledTime: "8:20 AM", coordinates: [23.0598, 72.4949] },
            { id: "iu-r4-13", name: "Shilaj Circle", scheduledTime: "8:25 AM", coordinates: [23.0526, 72.4717] },
            { id: "iu-r4-14", name: INDUS_CAMPUS.name, scheduledTime: "8:40 AM", coordinates: INDUS_CAMPUS.coordinates },
        ],
    },
    {
        id: "route-iu-r5",
        code: "IU-R5",
        name: "Vastral - Shivranjani - Indus University",
        busNumbers: ["5959", "4999", "8582"],
        primaryBusNumber: "5959",
        startPoint: "Odhav Ring Road",
        destination: INDUS_CAMPUS.name,
        campusArrival: "8:45 AM",
        distance: "31.2 km",
        studentCount: 138,
        mapCenter: [23.02, 72.536],
        notes: "Coordinates are approximate for route visualization.",
        stops: [
            { id: "iu-r5-01", name: "Odhav Ring Road", scheduledTime: "7:00 AM", coordinates: [23.0278, 72.6674] },
            { id: "iu-r5-02", name: "Vastral", scheduledTime: "7:10 AM", coordinates: [22.9997, 72.6634] },
            { id: "iu-r5-03", name: "Mahadevnagar", scheduledTime: "7:15 AM", coordinates: [22.9995, 72.6484] },
            { id: "iu-r5-04", name: "Rabari Colony", scheduledTime: "7:20 AM", coordinates: [22.9988, 72.6262] },
            { id: "iu-r5-05", name: "CTM", scheduledTime: "7:25 AM", coordinates: [22.9994, 72.6203] },
            { id: "iu-r5-06", name: "Jasodanagar", scheduledTime: "7:30 AM", coordinates: [22.9916, 72.6127] },
            { id: "iu-r5-07", name: "Ghodasar", scheduledTime: "7:30 AM", coordinates: [22.9787, 72.6072] },
            { id: "iu-r5-08", name: "Hirabhai Tower", scheduledTime: "7:35 AM", coordinates: [22.9969, 72.5808] },
            { id: "iu-r5-09", name: "Danilimda", scheduledTime: "7:40 AM", coordinates: [22.9976, 72.5769] },
            { id: "iu-r5-10", name: "Anjali Crossroad", scheduledTime: "7:50 AM", coordinates: [22.9969, 72.5507] },
            { id: "iu-r5-11", name: "Nehrunagar", scheduledTime: "7:55 AM", coordinates: [23.0225, 72.5437] },
            { id: "iu-r5-12", name: "Shivranjani", scheduledTime: "8:00 AM", coordinates: [23.0224, 72.5338] },
            { id: "iu-r5-13", name: "Keshavbaug", scheduledTime: "8:00 AM", coordinates: [23.0228, 72.5221] },
            { id: "iu-r5-14", name: "Mansi Tower", scheduledTime: "8:05 AM", coordinates: [23.0316, 72.5178] },
            { id: "iu-r5-15", name: "Judges Bunglow", scheduledTime: "8:05 AM", coordinates: [23.0342, 72.5152] },
            { id: "iu-r5-16", name: "Pakvaan", scheduledTime: "8:10 AM", coordinates: [23.0349, 72.5066] },
            { id: "iu-r5-17", name: "Sindhu Bhavan", scheduledTime: "8:15 AM", coordinates: [23.0398, 72.4976] },
            { id: "iu-r5-18", name: "Shilaj Circle", scheduledTime: "8:20 AM", coordinates: [23.0526, 72.4717] },
            { id: "iu-r5-19", name: INDUS_CAMPUS.name, scheduledTime: "8:45 AM", coordinates: INDUS_CAMPUS.coordinates },
        ],
    },
    {
        id: "route-iu-r6",
        code: "IU-R6",
        name: "Nikol - Gurukul - Indus University",
        busNumbers: ["6999", "3120", "2111"],
        primaryBusNumber: "6999",
        startPoint: "Manmohan",
        destination: INDUS_CAMPUS.name,
        campusArrival: "8:40 AM",
        distance: "30.6 km",
        studentCount: 132,
        mapCenter: [23.056, 72.545],
        notes: "Coordinates are approximate for route visualization.",
        stops: [
            { id: "iu-r6-01", name: "Manmohan", scheduledTime: "7:10 AM", coordinates: [23.0525, 72.6694] },
            { id: "iu-r6-02", name: "Nikol", scheduledTime: "7:10 AM", coordinates: [23.0497, 72.6673] },
            { id: "iu-r6-03", name: "Uma School", scheduledTime: "7:15 AM", coordinates: [23.0484, 72.6554] },
            { id: "iu-r6-04", name: "Gopal Chowk", scheduledTime: "7:15 AM", coordinates: [23.0488, 72.6484] },
            { id: "iu-r6-05", name: "Bapa Sitaram Chowk", scheduledTime: "7:20 AM", coordinates: [23.0469, 72.6402] },
            { id: "iu-r6-06", name: "Sardar Chowk", scheduledTime: "7:20 AM", coordinates: [23.0447, 72.6336] },
            { id: "iu-r6-07", name: "Vijay Park", scheduledTime: "7:25 AM", coordinates: [23.0415, 72.6283] },
            { id: "iu-r6-08", name: "Thakkarnagar", scheduledTime: "7:30 AM", coordinates: [23.0432, 72.6225] },
            { id: "iu-r6-09", name: "Shyam Shikhar", scheduledTime: "7:30 AM", coordinates: [23.0445, 72.6174] },
            { id: "iu-r6-10", name: "Kalupur", scheduledTime: "7:35 AM", coordinates: [23.0296, 72.6012] },
            { id: "iu-r6-11", name: "Dariyapur", scheduledTime: "7:40 AM", coordinates: [23.0359, 72.5954] },
            { id: "iu-r6-12", name: "Delhi Darwaja", scheduledTime: "7:40 AM", coordinates: [23.0392, 72.5891] },
            { id: "iu-r6-13", name: "Shahpur", scheduledTime: "7:45 AM", coordinates: [23.0408, 72.5831] },
            { id: "iu-r6-14", name: "Income Tax", scheduledTime: "7:50 AM", coordinates: [23.0395, 72.5718] },
            { id: "iu-r6-15", name: "Stadium", scheduledTime: "7:55 AM", coordinates: [23.0427, 72.5629] },
            { id: "iu-r6-16", name: "Swastik Crossroad", scheduledTime: "7:55 AM", coordinates: [23.0367, 72.5603] },
            { id: "iu-r6-17", name: "Commerce", scheduledTime: "7:55 AM", coordinates: [23.0391, 72.5538] },
            { id: "iu-r6-18", name: "Vijay Crossroad", scheduledTime: "8:00 AM", coordinates: [23.0462, 72.5526] },
            { id: "iu-r6-19", name: "Helmet", scheduledTime: "8:00 AM", coordinates: [23.0484, 72.5404] },
            { id: "iu-r6-20", name: "Gurukul", scheduledTime: "8:05 AM", coordinates: [23.0496, 72.5315] },
            { id: "iu-r6-21", name: "Drive In", scheduledTime: "8:05 AM", coordinates: [23.0507, 72.5256] },
            { id: "iu-r6-22", name: "Thaltej", scheduledTime: "8:10 AM", coordinates: [23.0501, 72.5022] },
            { id: "iu-r6-23", name: "Zydus Hospital", scheduledTime: "8:10 AM", coordinates: [23.0598, 72.4949] },
            { id: "iu-r6-24", name: "Shilaj", scheduledTime: "8:15 AM", coordinates: [23.0526, 72.4717] },
            { id: "iu-r6-25", name: INDUS_CAMPUS.name, scheduledTime: "8:40 AM", coordinates: INDUS_CAMPUS.coordinates },
        ],
    },
    {
        id: "route-iu-r7",
        code: "IU-R7",
        name: "Naroda - Vastrapur - Indus University",
        busNumbers: ["9846"],
        primaryBusNumber: "9846",
        startPoint: "Viratnagar",
        destination: INDUS_CAMPUS.name,
        campusArrival: "8:45 AM",
        distance: "28.9 km",
        studentCount: 92,
        mapCenter: [23.062, 72.556],
        notes: "Coordinates are approximate for route visualization.",
        stops: [
            { id: "iu-r7-01", name: "Viratnagar", scheduledTime: "7:10 AM", coordinates: [23.0382, 72.6478] },
            { id: "iu-r7-02", name: "Krishnanagar", scheduledTime: "7:15 AM", coordinates: [23.0549, 72.6369] },
            { id: "iu-r7-03", name: "Naroda Patiya", scheduledTime: "7:20 AM", coordinates: [23.0716, 72.6534] },
            { id: "iu-r7-04", name: "Memco", scheduledTime: "7:25 AM", coordinates: [23.0587, 72.6285] },
            { id: "iu-r7-05", name: "Meghaninagar", scheduledTime: "7:25 AM", coordinates: [23.0571, 72.6172] },
            { id: "iu-r7-06", name: "Ghevar Complex", scheduledTime: "7:30 AM", coordinates: [23.0647, 72.6116] },
            { id: "iu-r7-07", name: "Rajasthan Hospital", scheduledTime: "7:35 AM", coordinates: [23.0644, 72.6052] },
            { id: "iu-r7-08", name: "Namaste Circle", scheduledTime: "7:35 AM", coordinates: [23.0727, 72.5969] },
            { id: "iu-r7-09", name: "Subhash Bridge", scheduledTime: "7:40 AM", coordinates: [23.0649, 72.5882] },
            { id: "iu-r7-10", name: "Juna Vadaj", scheduledTime: "7:45 AM", coordinates: [23.0573, 72.5813] },
            { id: "iu-r7-11", name: "Usmanpura", scheduledTime: "7:45 AM", coordinates: [23.0455, 72.5724] },
            { id: "iu-r7-12", name: "Sardar Patel Statue", scheduledTime: "7:50 AM", coordinates: [23.0424, 72.5653] },
            { id: "iu-r7-13", name: "Memnagar Fire Station", scheduledTime: "7:50 AM", coordinates: [23.0525, 72.5448] },
            { id: "iu-r7-14", name: "Vijay Crossroad", scheduledTime: "7:55 AM", coordinates: [23.0462, 72.5526] },
            { id: "iu-r7-15", name: "University Road", scheduledTime: "7:55 AM", coordinates: [23.0417, 72.5438] },
            { id: "iu-r7-16", name: "Panjrapole", scheduledTime: "8:00 AM", coordinates: [23.0351, 72.5418] },
            { id: "iu-r7-17", name: "IIM", scheduledTime: "8:05 AM", coordinates: [23.0326, 72.5334] },
            { id: "iu-r7-18", name: "Vastrapur Lake", scheduledTime: "8:05 AM", coordinates: [23.0376, 72.5293] },
            { id: "iu-r7-19", name: "Gurudwara", scheduledTime: "8:10 AM", coordinates: [23.0451, 72.5148] },
            { id: "iu-r7-20", name: "Zydus Hospital", scheduledTime: "8:10 AM", coordinates: [23.0598, 72.4949] },
            { id: "iu-r7-21", name: INDUS_CAMPUS.name, scheduledTime: "8:45 AM", coordinates: INDUS_CAMPUS.coordinates },
        ],
    },
    {
        id: "route-iu-r8",
        code: "IU-R8",
        name: "Naroda Gam - Gota - Indus University",
        busNumbers: ["4668", "9331"],
        primaryBusNumber: "4668",
        startPoint: "Hari Darshan",
        destination: INDUS_CAMPUS.name,
        campusArrival: "8:35 AM",
        distance: "27.6 km",
        studentCount: 108,
        mapCenter: [23.108, 72.545],
        notes: "Coordinates are approximate for route visualization.",
        stops: [
            { id: "iu-r8-01", name: "Hari Darshan", scheduledTime: "7:15 AM", coordinates: [23.0731, 72.6653] },
            { id: "iu-r8-02", name: "Naroda Gam", scheduledTime: "7:15 AM", coordinates: [23.0822, 72.6572] },
            { id: "iu-r8-03", name: "Devi Cinema", scheduledTime: "7:20 AM", coordinates: [23.0908, 72.6475] },
            { id: "iu-r8-04", name: "ITI Underbridge", scheduledTime: "7:20 AM", coordinates: [23.0963, 72.6407] },
            { id: "iu-r8-05", name: "Kotarpur", scheduledTime: "7:25 AM", coordinates: [23.1055, 72.6337] },
            { id: "iu-r8-06", name: "Indira Bridge", scheduledTime: "7:30 AM", coordinates: [23.1078, 72.6302] },
            { id: "iu-r8-07", name: "Koba Circle", scheduledTime: "7:35 AM", coordinates: [23.1378, 72.6266] },
            { id: "iu-r8-08", name: "Sargasan", scheduledTime: "7:40 AM", coordinates: [23.1901, 72.6217] },
            { id: "iu-r8-09", name: "Adalaj", scheduledTime: "7:45 AM", coordinates: [23.1668, 72.5811] },
            { id: "iu-r8-10", name: "Vaishno Devi", scheduledTime: "7:55 AM", coordinates: [23.1333, 72.5391] },
            { id: "iu-r8-11", name: "Gota", scheduledTime: "8:00 AM", coordinates: [23.1013, 72.5386] },
            { id: "iu-r8-12", name: "Sola Bhagvat", scheduledTime: "8:05 AM", coordinates: [23.0762, 72.5229] },
            { id: "iu-r8-13", name: "Zydus Hospital", scheduledTime: "8:10 AM", coordinates: [23.0598, 72.4949] },
            { id: "iu-r8-14", name: "Baghban Party Plot", scheduledTime: "8:10 AM", coordinates: [23.0598, 72.4819] },
            { id: "iu-r8-15", name: "Shilaj Circle", scheduledTime: "8:15 AM", coordinates: [23.0526, 72.4717] },
            { id: "iu-r8-16", name: INDUS_CAMPUS.name, scheduledTime: "8:35 AM", coordinates: INDUS_CAMPUS.coordinates },
        ],
    },
];

export const defaultStudentRouteCode = "IU-R4";
export const defaultStaffRouteCode = "IU-R4";

export const getIndusRouteByCode = (code) => indusRoutes.find((route) => route.code === code);
export const defaultStudentRoute = getIndusRouteByCode(defaultStudentRouteCode);
export const defaultStaffRoute = getIndusRouteByCode(defaultStaffRouteCode);

export const getPrimaryBusLabel = (route) => route.primaryBusNumber;
export const getBusRegistration = (route) => `GJ-01-FT-${route.primaryBusNumber}`;
export const getRouteLabel = (route) => `${route.code} - ${route.name}`;

export const getRouteServiceLabel = (route) => `${getPrimaryBusLabel(route)} / Route ${route.code}`;

export const withStopProgress = (route, currentStopId) => route.stops.map((stop) => {
    const currentIndex = route.stops.findIndex((item) => item.id === currentStopId);
    const stopIndex = route.stops.findIndex((item) => item.id === stop.id);
    return {
        ...stop,
        status: stopIndex < currentIndex ? "completed" : stop.id === currentStopId ? "current" : "upcoming",
    };
});

export function normalizeTripDirection(direction) {
    return direction === "return" ? "return" : "morning";
}

export function tripDirectionLabel(direction) {
    return normalizeTripDirection(direction) === "return" ? "Return" : "Morning";
}

function formatScheduleMinutes(totalMinutes) {
    const normalized = ((totalMinutes % 1440) + 1440) % 1440;
    const hours24 = Math.floor(normalized / 60);
    const minutes = normalized % 60;
    const period = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 || 12;
    return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function routeStopsForDirection(route, direction = "morning") {
    if (normalizeTripDirection(direction) !== "return")
        return route.stops;
    const returnDepartureMinutes = 16 * 60 + 35;
    return [...route.stops].reverse().map((stop, index) => ({
        ...stop,
        scheduledTime: formatScheduleMinutes(returnDepartureMinutes + index * 5),
    }));
}

export function routeForTripDirection(route, direction = "morning") {
    const normalizedDirection = normalizeTripDirection(direction);
    if (normalizedDirection !== "return") {
        return {
            ...route,
            direction: "morning",
            stops: routeStopsForDirection(route, "morning"),
        };
    }
    const stops = routeStopsForDirection(route, "return");
    return {
        ...route,
        direction: "return",
        name: `${route.destination} - ${route.startPoint}`,
        startPoint: route.destination,
        destination: route.startPoint,
        campusArrival: stops.at(-1)?.scheduledTime ?? route.campusArrival,
        stops,
    };
}
