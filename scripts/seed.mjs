/* Admin seeder — writes a realistic demo dataset straight to Firestore using the
   service account (bypasses rules). For management previews.
   Run:  node scripts/seed.mjs        (uses ./service-account.json) */
import admin from "firebase-admin";
import fs from "fs";

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || (fs.existsSync("./service-account.json") ? "./service-account.json" : "./bot/service-account.json");
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, "utf8"))) });
const db = admin.firestore();

const TEAMS = [
  { team: "Team A", name: "Aziz", id: "seed_aziz" },
  { team: "Team B", name: "Diana", id: "seed_diana" },
  { team: "Team C", name: "Bek", id: "seed_bek" },
  { team: "Team E", name: "Lola", id: "seed_lola" },
  { team: "Team X", name: "Otabek", id: "seed_otabek" },
];
const LANES = [["Dallas, TX","Northlake, TX"],["Atlanta, GA","Miami, FL"],["Chicago, IL","Dallas, TX"],["Los Angeles, CA","Phoenix, AZ"],["Newark, NJ","Columbus, OH"],["Houston, TX","Denver, CO"],["Seattle, WA","Portland, OR"],["Charlotte, NC","Nashville, TN"],["Tallahassee, FL","Opa Locka, FL"],["Chattanooga, TN","Jackson, GA"],["Fort Worth, TX","Stockton, CA"],["Concord, NC","Claremont, NC"]];
const BROKERS = ["Amazon Relay","TQL","CH Robinson","Coyote","RXO","Landstar"];
const CARRIERS = ["Zemen Logistics LLC","Silk Road Logistics","Eagle Owner-Op","Prime Star LLC","BlueLine Trucking","Nomad Freight"];
const DRIVERS = [
  { name:"Khurshed Amirdinov", phone:"+1 (412) 689-2705", unit:"202", payType:"percent" },
  { name:"Doniyor Nuritdinov", phone:"+1 (407) 766-4240", unit:"203", payType:"cpm" },
  { name:"Zayniddin Mirzakabilov", phone:"+1 (312) 555-0142", unit:"204", payType:"cpm" },
  { name:"Abrorkhuja Imankhojaev", phone:"+1 (469) 555-0188", unit:"205", payType:"percent" },
  { name:"Devin Gary", phone:"+1 (615) 555-0133", unit:"206", payType:"cpm" },
  { name:"Gregory Tapia", phone:"+1 (214) 555-0177", unit:"207", payType:"cpm" },
];
const EQUIP = ["van","reefer","van","van","flatbed"];
const STATUSES = ["available","booked","dispatched","in_transit","delivered","invoiced"];
const day = (o) => { const d = new Date(); d.setDate(d.getDate()+o); return d.toISOString().slice(0,10); };

const batch = db.batch();

for (let i=0;i<DRIVERS.length;i++) {
  const d = DRIVERS[i];
  batch.set(db.collection("drivers").doc(), { ...d, carrier: CARRIERS[(i%5)+1], truck:"TRK-"+(1000+i*7), active:true, createdAt: Date.now()-i*86400000 });
}

let n=0;
for (let dd=0; dd<=4; dd++) {
  const count = dd===0 ? 9 : 4;
  for (let k=0;k<count;k++) {
    const t = TEAMS[n%TEAMS.length];
    const [origin,destination] = LANES[n%LANES.length];
    const drv = DRIVERS[n%DRIVERS.length];
    const status = dd===0 ? STATUSES[k%4] : dd>=3 ? ["delivered","invoiced"][k%2] : STATUSES[2+(k%4)];
    const created = Date.now()-dd*86400000-k*1800000;
    const gross = 1500 + ((n*211)%4200);
    const docs = {};
    if (["booked","dispatched","in_transit","delivered","invoiced"].includes(status)) docs.rate_con={received:true,at:created,by:"Sam"};
    if (["in_transit","delivered","invoiced"].includes(status)) docs.bol={received:true,at:created,by:"Sam"};
    if (["delivered","invoiced"].includes(status)) docs.pod={received:true,at:created,by:"Sam"};
    batch.set(db.collection("loads").doc(), {
      loadNumber:"S-"+(1000+n), source:"manual", broker:BROKERS[n%6], carrier:CARRIERS[(n%5)+1],
      driver:drv.name, driverPhone:drv.phone, origin, destination, pickupDate:day(-dd), deliveryDate:day(-dd+1),
      equipment:EQUIP[n%5], miles:300+((n*67)%1800), gross, dispatcherId:t.id, dispatcherName:t.name, team:t.team,
      status, checkCalls:[], docs, createdAt:created, updatedAt:created,
    });
    n++;
  }
}

// Amazon multi-stop route load for the Update Board
const ac = Date.now()-5400000;
batch.set(db.collection("loads").doc(), {
  loadNumber:"115C6Z4F6", source:"amazon", broker:"Amazon Relay", carrier:"Zemen Logistics LLC",
  driver:"Khurshed Amirdinov", driverPhone:"+1 (412) 689-2705", origin:"Tallahassee, FL", destination:"Opa Locka, FL",
  pickupDate:day(0), deliveryDate:day(1), equipment:"van", miles:502, gross:1480,
  dispatcherId:"seed_aziz", dispatcherName:"Aziz", team:"Team A", status:"in_transit",
  checkCalls:[{ts:ac,by:"Sam",note:"Loaded at TLH2, rolling",status:"in_transit"}], lastUpdate:"Loaded at TLH2, rolling", lastUpdateAt:ac,
  docs:{rate_con:{received:true,at:ac,by:"Sam"}},
  amazon:{ tourId:"115C6Z4F6", version:3, tourState:"active", workType:"SPOT", transitOperatorType:"SOLO", ratePerMile:2.95, legs:1, maxWeight:42000, specialServices:["RESTRICTED_ROAD"],
    stops:[
      {type:"PICKUP",label:"TLH2",line1:"2635 Vineland Dr",city:"Tallahassee",state:"FL",postalCode:"32308-1421",scheduledArrival:new Date(ac).toISOString(),timeZone:"America/New_York",loaded:true,loadingType:"PRELOADED"},
      {type:"DROPOFF",label:"MIA2",line1:"14250 Aviation Dr",city:"Opa Locka",state:"FL",postalCode:"33054-2389",scheduledArrival:new Date(ac+36000000).toISOString(),timeZone:"America/New_York",loaded:true,loadingType:"DROP",specialServices:["RESTRICTED_ROAD"],earlyCheckInNotAllowed:true},
    ]},
  createdAt:ac, updatedAt:ac,
});

for (const inv of [
  { number:"INV-1001", carrier:"Silk Road Logistics", loadIds:[], periodStart:day(-7), periodEnd:day(0), totalGross:11800, commissionPct:5, amountDue:590, status:"paid", dueDate:day(-1), paidAt:Date.now()-86400000, createdAt:Date.now()-5*86400000 },
  { number:"INV-1002", carrier:"Eagle Owner-Op", loadIds:[], periodStart:day(-7), periodEnd:day(0), totalGross:9460, commissionPct:5, amountDue:473, status:"sent", dueDate:day(7), createdAt:Date.now()-2*86400000 },
]) batch.set(db.collection("invoices").doc(), inv);

await batch.commit();
console.log(`✓ Seeded ${n+1} loads, ${DRIVERS.length} drivers, 2 invoices.`);
process.exit(0);
