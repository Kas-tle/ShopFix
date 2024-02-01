import fs from 'fs';
import { MessageType, statusMessage } from "./src/util/console";
import { databaseConnection, updateRows } from "./src/util/database";

async function main(): Promise<void> {
    // Needed for exit handler
    process.stdin.resume();

    const currentTimestamp = Date.now();

    // Find sqlite or db file in current directory
    const databaseFiles = fs.readdirSync(process.cwd()).filter((file) => file.endsWith('.sqlite') || file.endsWith('.db'));

    if (databaseFiles.length === 0) {
        statusMessage(MessageType.Critical, 'No sqlite file found in current directory');
        process.kill(process.pid, 'SIGINT');
    }

    const database = await databaseConnection(databaseFiles[0]);

    const whereValues: (string | number | boolean | null)[] = [];
    const updateKeys: string[] = ['shopItems'];
    const updateValues: (string | number | boolean | null)[][] = [];

    const updateCount = [0];

    await new Promise((resolve, reject) => {database.all(`SELECT id, shopItems FROM shops WHERE shopItems != '[]'`, (err: Error | null, rows: { id: string, shopItems: string }[]) => {
        if (err) {
            statusMessage(MessageType.Error, `Error querying table 'shops': ${err.message}`);
            reject();
        } else {
            statusMessage(MessageType.Plain, `Found ${rows.length} rows with shopItems not equal to '[]'`);

            const endTimes: number[] = [];

            // Find all endTimestamps that are less than startTimestamp and add them to endTimes array
            rows.forEach((row) => {
                const shopItems: { state: "CANCELLED" | "IN_PROGRESS", "startTimestamp": number, "endTimestamp": number }[] = JSON.parse(row.shopItems);

                for (let i = 0; i < shopItems.length; i++) {
                    if (shopItems[i].state !== 'CANCELLED' && shopItems[i].startTimestamp > shopItems[i].endTimestamp) {
                        endTimes.push(shopItems[i].endTimestamp);
                    }
                }
            });

            // Order endTimes in ascending order and create map of ms value to add to each endTimestamp
            endTimes.sort((a, b) => a - b);

            // Create map of ms value to add to each endTimestamp
            const msMap: Map<number, number> = new Map();
            for (let i = 0; i < endTimes.length; i++) {
                msMap.set(endTimes[i], i);
            }

            rows.forEach((row) => {
                const shopItems: { state: "CANCELLED" | "IN_PROGRESS", "startTimestamp": number, "endTimestamp": number }[] = JSON.parse(row.shopItems);
                
                // If state is not CANCELLED and startTimestamp > endTimestamp, set endTimestamp to 3 months in the future from now
                for (let i = 0; i < shopItems.length; i++) {
                    if (shopItems[i].state !== 'CANCELLED' && shopItems[i].startTimestamp > shopItems[i].endTimestamp) {
                        shopItems[i].endTimestamp = currentTimestamp + 7776000000 + (msMap.get(shopItems[i].endTimestamp) ?? 0);
                        updateCount[0]++;
                    }
                }

                whereValues.push(row.id);
                updateValues.push([JSON.stringify(shopItems)]);
            });

            resolve(0);
        }
    })});

    // Update the rows
    await updateRows(database, 'shops', 'id', whereValues, updateKeys, updateValues);

    // Close the database
    database.close();
    statusMessage(MessageType.Completion, `Database connection closed after updating ${updateCount[0]} items`);

    process.kill(process.pid, 'SIGINT');
}

main();