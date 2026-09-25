# Stop Location Review

Checked 25 September 2026. Source: the application database, read-only snapshot at revision 51; subsequent two-pin live update is recorded separately. The hosted API's short-lived test session was found in that database, confirming that this is the database serving the live application.

## Verified Scope

- 9 routes and 159 ordered stop entries have numeric in-range coordinates. No identical coordinate pair occurs twice within one route in this snapshot. This is structural validity, not proof of an actual pickup point.
- The owner provided exact map references for Electrotherm and Saanvi on IU-R9. The selected-place latitude/longitude from each link was used, not the map viewport centre. Both corrections were accepted by the live API and confirmed through fresh API and database reads. Other stops, names, schedules and ordering were preserved.
- Saanvi's supplied reference is labelled DEVANSH Pan Parlour on Google Maps. The application stop remains named Saanvi; the reference is a landmark, not a reason to rename the stop.
- The university pin differs between IU-R9 and IU-R1 through IU-R8 by approximately 317 metres. Neither was guessed or changed. The transport office must identify the actual boarding bay/gate.
- The other 157 entries remain unverified as physical pickup locations. An online place match cannot confirm which side of the road, gate or safe boarding area the bus uses.

Evidence: [snapshot/restore](qa/2026-09-25-handover/backup-restore.json), [owner-supplied references](qa/2026-09-25-handover/confirmed-stop-pins.json), [live save verification](qa/2026-09-25-handover/live-stop-check.json).

## Efficient Verification

Ask the route's driver/transport coordinator to share one dropped Google Maps pin for the exact pickup area per stop, in route order. Record the route, stop, direction, verifier and date. A business listing can be used only when that is the agreed boarding point. Morning and return road-side points may differ.

In Admin > Routes > Edit, select the existing stop above the map, move its pin, save, then refresh/reopen to verify persistence. Do not create a second stop just to change its pin. Do not edit an active journey's route; wait for its normal completion. Preserve names, IDs and order unless the transport office explicitly changes them.

The [official university contact page](https://indusuni.ac.in/contact-us.php) supports the Rancharda/via Shilaj campus address, but does not establish the precise bus boarding bay. The coordinates embedded in a map viewport are not proof of that bay.

## Complete Review List

Review links below open the stored point. A link alone is not validation.

| Route | Stop | Latitude, longitude | Status | Map reference |
| --- | --- | --- | --- | --- |
| IU-R9 | Satelite | 23.016595, 72.515595 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.016595%2C72.515595) |
| IU-R9 | Ghuma Gaam | 23.030844, 72.448304 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.030844%2C72.448304) |
| IU-R9 | Electrotherm | 23.0545106, 72.4426477 | Owner reference applied; not field-surveyed | [Open point](https://maps.app.goo.gl/nrXRhMBQAdSEbdij6) |
| IU-R9 | Saanvi | 23.0609367, 72.4388982 | Owner reference applied; not field-surveyed | [Open point](https://maps.app.goo.gl/JZnABcek8EWQhbX19) |
| IU-R9 | Indus University | 23.06805, 72.4402 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.06805%2C72.4402) |
| IU-R1 | Aavkar Hall | 22.9869, 72.6116 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9869%2C72.6116) |
| IU-R1 | Maninagar Crossing | 22.9971, 72.6117 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9971%2C72.6117) |
| IU-R1 | Maninagar Station | 22.9981, 72.6112 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9981%2C72.6112) |
| IU-R1 | Rambaug | 23.0038, 72.6071 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0038%2C72.6071) |
| IU-R1 | Kankaria | 23.0061, 72.6026 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0061%2C72.6026) |
| IU-R1 | Football Ground | 23.0127, 72.5948 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0127%2C72.5948) |
| IU-R1 | Bhulabhai | 23.0094, 72.5868 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0094%2C72.5868) |
| IU-R1 | Geeta Mandir | 23.0157, 72.5891 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0157%2C72.5891) |
| IU-R1 | NID | 23.0117, 72.5703 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0117%2C72.5703) |
| IU-R1 | Paldi | 23.0122, 72.5625 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0122%2C72.5625) |
| IU-R1 | Fatehpura | 23.0061, 72.5566 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0061%2C72.5566) |
| IU-R1 | Anjali | 22.9969, 72.5507 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9969%2C72.5507) |
| IU-R1 | Dharnidhar | 22.9996, 72.5442 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9996%2C72.5442) |
| IU-R1 | Manekbaug | 23.0115, 72.5318 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0115%2C72.5318) |
| IU-R1 | Shyammal | 23.0146, 72.5238 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0146%2C72.5238) |
| IU-R1 | Keshavbaug | 23.0228, 72.5221 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0228%2C72.5221) |
| IU-R1 | Mansi Tower | 23.0316, 72.5178 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0316%2C72.5178) |
| IU-R1 | Judges Bunglow | 23.0342, 72.5152 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0342%2C72.5152) |
| IU-R1 | Pakvaan | 23.0349, 72.5066 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0349%2C72.5066) |
| IU-R1 | Indus University | 23.0652, 72.4402 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0652%2C72.4402) |
| IU-R2 | Partheshwar | 22.9771, 72.6043 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9771%2C72.6043) |
| IU-R2 | Ishanpur | 22.9824, 72.6007 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9824%2C72.6007) |
| IU-R2 | Ramvadi | 22.9868, 72.5952 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9868%2C72.5952) |
| IU-R2 | Jaymala | 22.9934, 72.5894 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9934%2C72.5894) |
| IU-R2 | Hirabhai Tower | 22.9969, 72.5808 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9969%2C72.5808) |
| IU-R2 | Jawahar Chowk | 23.0011, 72.5728 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0011%2C72.5728) |
| IU-R2 | Bhairavnath | 22.9991, 72.5664 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9991%2C72.5664) |
| IU-R2 | Danilimda | 22.9976, 72.5769 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9976%2C72.5769) |
| IU-R2 | Chandranagar | 22.9944, 72.5606 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9944%2C72.5606) |
| IU-R2 | Anjali Crossroad | 22.9969, 72.5507 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9969%2C72.5507) |
| IU-R2 | Vasna Bus Stand | 22.9995, 72.5401 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9995%2C72.5401) |
| IU-R2 | Jivraj Mehta Hospital | 23.0034, 72.5365 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0034%2C72.5365) |
| IU-R2 | Malav Talav | 23.0005, 72.5324 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0005%2C72.5324) |
| IU-R2 | Jivraj Park | 23.0066, 72.5308 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0066%2C72.5308) |
| IU-R2 | Shyammal | 23.0146, 72.5238 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0146%2C72.5238) |
| IU-R2 | Sachin Tower | 23.0185, 72.5207 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0185%2C72.5207) |
| IU-R2 | Anandnagar | 23.0261, 72.5116 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0261%2C72.5116) |
| IU-R2 | Prernatirth Deraser | 23.0281, 72.5072 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0281%2C72.5072) |
| IU-R2 | Star Bazar | 23.0309, 72.5091 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0309%2C72.5091) |
| IU-R2 | Ramdevnagar | 23.0342, 72.5017 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0342%2C72.5017) |
| IU-R2 | Iscon | 23.0309, 72.5034 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0309%2C72.5034) |
| IU-R2 | Bopal | 23.0358, 72.4656 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0358%2C72.4656) |
| IU-R2 | Indus University | 23.0652, 72.4402 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0652%2C72.4402) |
| IU-R3 | Icon Crossroad | 23.1056, 72.6264 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.1056%2C72.6264) |
| IU-R3 | Godrej Garden City | 23.1195, 72.6102 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.1195%2C72.6102) |
| IU-R3 | Chandkheda | 23.1099, 72.5844 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.1099%2C72.5844) |
| IU-R3 | New CG Road | 23.1121, 72.5749 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.1121%2C72.5749) |
| IU-R3 | Visat Petrol Pump | 23.1005, 72.5812 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.1005%2C72.5812) |
| IU-R3 | Sabarmati | 23.0838, 72.5867 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0838%2C72.5867) |
| IU-R3 | RTO | 23.0789, 72.5776 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0789%2C72.5776) |
| IU-R3 | Vyaswadi | 23.0719, 72.5689 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0719%2C72.5689) |
| IU-R3 | Akhbarnagar | 23.0716, 72.5593 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0716%2C72.5593) |
| IU-R3 | Umiya Hall | 23.0703, 72.5501 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0703%2C72.5501) |
| IU-R3 | Prabhat Chowk | 23.0673, 72.5441 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0673%2C72.5441) |
| IU-R3 | Sola Road | 23.0697, 72.5324 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0697%2C72.5324) |
| IU-R3 | Sola Bhagvat | 23.0762, 72.5229 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0762%2C72.5229) |
| IU-R3 | Kargil Petrol Pump | 23.0794, 72.5165 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0794%2C72.5165) |
| IU-R3 | Science City | 23.0806, 72.4957 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0806%2C72.4957) |
| IU-R3 | Indus University | 23.0652, 72.4402 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0652%2C72.4402) |
| IU-R4 | Vyaswadi | 23.0719, 72.5689 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0719%2C72.5689) |
| IU-R4 | Akhbarnagar | 23.0716, 72.5593 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0716%2C72.5593) |
| IU-R4 | Umiya Hall | 23.0703, 72.5501 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0703%2C72.5501) |
| IU-R4 | Sola Road | 23.0697, 72.5324 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0697%2C72.5324) |
| IU-R4 | Prabhat Chowk | 23.0673, 72.5441 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0673%2C72.5441) |
| IU-R4 | Pallav Crossroad | 23.0633, 72.5391 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0633%2C72.5391) |
| IU-R4 | AEC Crossroad | 23.0617, 72.5307 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0617%2C72.5307) |
| IU-R4 | Bhuyangdev | 23.0638, 72.5234 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0638%2C72.5234) |
| IU-R4 | Surdhara Circle | 23.0645, 72.5169 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0645%2C72.5169) |
| IU-R4 | SAL Hospital | 23.0631, 72.5089 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0631%2C72.5089) |
| IU-R4 | Thaltej | 23.0501, 72.5022 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0501%2C72.5022) |
| IU-R4 | Zydus Hospital | 23.0598, 72.4949 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0598%2C72.4949) |
| IU-R4 | Shilaj Circle | 23.0526, 72.4717 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0526%2C72.4717) |
| IU-R4 | Indus University | 23.0652, 72.4402 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0652%2C72.4402) |
| IU-R5 | Odhav Ring Road | 23.0278, 72.6674 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0278%2C72.6674) |
| IU-R5 | Vastral | 22.9997, 72.6634 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9997%2C72.6634) |
| IU-R5 | Mahadevnagar | 22.9995, 72.6484 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9995%2C72.6484) |
| IU-R5 | Rabari Colony | 22.9988, 72.6262 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9988%2C72.6262) |
| IU-R5 | CTM | 22.9994, 72.6203 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9994%2C72.6203) |
| IU-R5 | Jasodanagar | 22.9916, 72.6127 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9916%2C72.6127) |
| IU-R5 | Ghodasar | 22.9787, 72.6072 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9787%2C72.6072) |
| IU-R5 | Hirabhai Tower | 22.9969, 72.5808 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9969%2C72.5808) |
| IU-R5 | Danilimda | 22.9976, 72.5769 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9976%2C72.5769) |
| IU-R5 | Anjali Crossroad | 22.9969, 72.5507 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=22.9969%2C72.5507) |
| IU-R5 | Nehrunagar | 23.0225, 72.5437 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0225%2C72.5437) |
| IU-R5 | Shivranjani | 23.0224, 72.5338 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0224%2C72.5338) |
| IU-R5 | Keshavbaug | 23.0228, 72.5221 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0228%2C72.5221) |
| IU-R5 | Mansi Tower | 23.0316, 72.5178 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0316%2C72.5178) |
| IU-R5 | Judges Bunglow | 23.0342, 72.5152 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0342%2C72.5152) |
| IU-R5 | Pakvaan | 23.0349, 72.5066 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0349%2C72.5066) |
| IU-R5 | Sindhu Bhavan | 23.0398, 72.4976 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0398%2C72.4976) |
| IU-R5 | Shilaj Circle | 23.0526, 72.4717 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0526%2C72.4717) |
| IU-R5 | Indus University | 23.0652, 72.4402 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0652%2C72.4402) |
| IU-R6 | Manmohan | 23.0525, 72.6694 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0525%2C72.6694) |
| IU-R6 | Nikol | 23.0497, 72.6673 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0497%2C72.6673) |
| IU-R6 | Uma School | 23.0484, 72.6554 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0484%2C72.6554) |
| IU-R6 | Gopal Chowk | 23.0488, 72.6484 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0488%2C72.6484) |
| IU-R6 | Bapa Sitaram Chowk | 23.0469, 72.6402 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0469%2C72.6402) |
| IU-R6 | Sardar Chowk | 23.0447, 72.6336 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0447%2C72.6336) |
| IU-R6 | Vijay Park | 23.0415, 72.6283 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0415%2C72.6283) |
| IU-R6 | Thakkarnagar | 23.0432, 72.6225 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0432%2C72.6225) |
| IU-R6 | Shyam Shikhar | 23.0445, 72.6174 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0445%2C72.6174) |
| IU-R6 | Kalupur | 23.0296, 72.6012 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0296%2C72.6012) |
| IU-R6 | Dariyapur | 23.0359, 72.5954 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0359%2C72.5954) |
| IU-R6 | Delhi Darwaja | 23.0392, 72.5891 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0392%2C72.5891) |
| IU-R6 | Shahpur | 23.0408, 72.5831 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0408%2C72.5831) |
| IU-R6 | Income Tax | 23.0395, 72.5718 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0395%2C72.5718) |
| IU-R6 | Stadium | 23.0427, 72.5629 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0427%2C72.5629) |
| IU-R6 | Swastik Crossroad | 23.0367, 72.5603 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0367%2C72.5603) |
| IU-R6 | Commerce | 23.0391, 72.5538 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0391%2C72.5538) |
| IU-R6 | Vijay Crossroad | 23.0462, 72.5526 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0462%2C72.5526) |
| IU-R6 | Helmet | 23.0484, 72.5404 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0484%2C72.5404) |
| IU-R6 | Gurukul | 23.0496, 72.5315 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0496%2C72.5315) |
| IU-R6 | Drive In | 23.0507, 72.5256 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0507%2C72.5256) |
| IU-R6 | Thaltej | 23.0501, 72.5022 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0501%2C72.5022) |
| IU-R6 | Zydus Hospital | 23.0598, 72.4949 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0598%2C72.4949) |
| IU-R6 | Shilaj | 23.0526, 72.4717 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0526%2C72.4717) |
| IU-R6 | Indus University | 23.0652, 72.4402 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0652%2C72.4402) |
| IU-R7 | Viratnagar | 23.0382, 72.6478 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0382%2C72.6478) |
| IU-R7 | Krishnanagar | 23.0549, 72.6369 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0549%2C72.6369) |
| IU-R7 | Naroda Patiya | 23.0716, 72.6534 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0716%2C72.6534) |
| IU-R7 | Memco | 23.0587, 72.6285 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0587%2C72.6285) |
| IU-R7 | Meghaninagar | 23.0571, 72.6172 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0571%2C72.6172) |
| IU-R7 | Ghevar Complex | 23.0647, 72.6116 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0647%2C72.6116) |
| IU-R7 | Rajasthan Hospital | 23.0644, 72.6052 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0644%2C72.6052) |
| IU-R7 | Namaste Circle | 23.0727, 72.5969 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0727%2C72.5969) |
| IU-R7 | Subhash Bridge | 23.0649, 72.5882 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0649%2C72.5882) |
| IU-R7 | Juna Vadaj | 23.0573, 72.5813 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0573%2C72.5813) |
| IU-R7 | Usmanpura | 23.0455, 72.5724 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0455%2C72.5724) |
| IU-R7 | Sardar Patel Statue | 23.0424, 72.5653 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0424%2C72.5653) |
| IU-R7 | Memnagar Fire Station | 23.0525, 72.5448 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0525%2C72.5448) |
| IU-R7 | Vijay Crossroad | 23.0462, 72.5526 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0462%2C72.5526) |
| IU-R7 | University Road | 23.0417, 72.5438 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0417%2C72.5438) |
| IU-R7 | Panjrapole | 23.0351, 72.5418 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0351%2C72.5418) |
| IU-R7 | IIM | 23.0326, 72.5334 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0326%2C72.5334) |
| IU-R7 | Vastrapur Lake | 23.0376, 72.5293 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0376%2C72.5293) |
| IU-R7 | Gurudwara | 23.0451, 72.5148 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0451%2C72.5148) |
| IU-R7 | Zydus Hospital | 23.0598, 72.4949 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0598%2C72.4949) |
| IU-R7 | Indus University | 23.0652, 72.4402 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0652%2C72.4402) |
| IU-R8 | Hari Darshan | 23.0731, 72.6653 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0731%2C72.6653) |
| IU-R8 | Naroda Gam | 23.0822, 72.6572 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0822%2C72.6572) |
| IU-R8 | Devi Cinema | 23.0908, 72.6475 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0908%2C72.6475) |
| IU-R8 | ITI Underbridge | 23.0963, 72.6407 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0963%2C72.6407) |
| IU-R8 | Kotarpur | 23.1055, 72.6337 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.1055%2C72.6337) |
| IU-R8 | Indira Bridge | 23.1078, 72.6302 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.1078%2C72.6302) |
| IU-R8 | Koba Circle | 23.1378, 72.6266 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.1378%2C72.6266) |
| IU-R8 | Sargasan | 23.1901, 72.6217 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.1901%2C72.6217) |
| IU-R8 | Adalaj | 23.1668, 72.5811 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.1668%2C72.5811) |
| IU-R8 | Vaishno Devi | 23.1333, 72.5391 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.1333%2C72.5391) |
| IU-R8 | Gota | 23.1013, 72.5386 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.1013%2C72.5386) |
| IU-R8 | Sola Bhagvat | 23.0762, 72.5229 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0762%2C72.5229) |
| IU-R8 | Zydus Hospital | 23.0598, 72.4949 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0598%2C72.4949) |
| IU-R8 | Baghban Party Plot | 23.0598, 72.4819 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0598%2C72.4819) |
| IU-R8 | Shilaj Circle | 23.0526, 72.4717 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0526%2C72.4717) |
| IU-R8 | Indus University | 23.0652, 72.4402 | Pickup confirmation required | [Open point](https://www.google.com/maps/search/?api=1&query=23.0652%2C72.4402) |
