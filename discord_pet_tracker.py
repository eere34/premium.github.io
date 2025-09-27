import discord
import re
import os
from fastapi import FastAPI, Response
from threading import Thread
import uvicorn
import time
import json

DISCORD_TOKEN = os.environ.get("DISCORD_TOKEN")
CHANNEL_ID = 1417960188085796895

app = FastAPI()
pet_servers = []

def strip_code_block(text):
    return text.replace("```lua", "").replace("```", "").replace("\n", "").replace("\r", "").strip()

def parse_pet_embed(embed):
    name = mutation = dps = tier = jobId = placeId = joinScript = None
    players = None
    for field in embed.fields:
        fname = field.name.strip().lower()
        fvalue = field.value.strip()
        if "name" in fname:
            name = fvalue
        elif "mutation" in fname:
            mutation = fvalue
        elif "generation" in fname or "per sec" in fname or "money" in fname or "dps" in fname:
            dps = fvalue
        elif "tier" in fname:
            tier = fvalue
        elif "players" in fname:
            m = re.match(r"(\d+)/(\d+)", fvalue)
            if m:
                players = {
                    "current": int(m.group(1)),
                    "max": int(m.group(2))
                }
        elif "jobid" in fname:
            jobId = strip_code_block(fvalue)
        elif "join script" in fname:
            joinScript = strip_code_block(fvalue)
            m = re.search(r'TeleportToPlaceInstance\((\d+),\s*["\']?([\w-]+)["\']?', joinScript)
            if m:
                placeId = m.group(1)
                jobId2 = m.group(2)
                if not jobId and jobId2:
                    jobId = jobId2
    if players and (3 <= players["current"] <= 8):
        if name and jobId and placeId:
            return {
                "name": name,
                "mutation": mutation or "",
                "dps": dps or "",
                "tier": tier or "",
                "players": f'{players["current"]}/{players["max"]}',
                "jobId": jobId,
                "placeId": placeId,
                "joinScript": joinScript or "",
                "timestamp": discord.utils.utcnow().timestamp(),
            }
    return None

class PetClient(discord.Client):
    async def on_ready(self):
        print(f'Logged in as {self.user} (ID: {self.user.id})')

    async def on_message(self, message):
        if message.channel.id == CHANNEL_ID:
            for embed in message.embeds:
                pet = parse_pet_embed(embed)
                if pet:
                    if not any(p["jobId"] == pet["jobId"] and p["name"] == pet["name"] for p in pet_servers):
                        pet_servers.append(pet)
                        if len(pet_servers) > 60:
                            pet_servers.pop(0)
                    break

@app.get("/recent-pets")
async def recent_pets():
    now = time.time()
    filtered = [p for p in pet_servers if now - p["timestamp"] < 900]
    for p in filtered:
        p["time_found_ago"] = int(now - p["timestamp"])
    ndjson = "\n".join(json.dumps(p, ensure_ascii=False) for p in filtered)
    return Response(content=ndjson, media_type="text/plain")

def run_api():
    uvicorn.run(app, host="0.0.0.0", port=8080, workers=1)

if __name__ == "__main__":
    Thread(target=run_api, daemon=True).start()
    intents = discord.Intents.default()
    intents.message_content = True
    client = PetClient(intents=intents)
    client.run(DISCORD_TOKEN)
