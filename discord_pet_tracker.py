import discord
import re
import os
from flask import Flask, jsonify
from threading import Thread

DISCORD_TOKEN = os.environ.get("DISCORD_TOKEN")
CHANNEL_ID = 1417960188085796895  # Replace with your Discord channel ID

app = Flask(__name__)
pet_servers = []

def strip_code_block(text):
    if text.startswith("```") and text.endswith("```"):
        return text[3:-3].strip()
    return text.strip()

def parse_pet_embed(embed):
    name = mutation = dps = tier = jobId = placeId = None
    players = None

    for field in embed.fields:
        fname = field.name.strip().lower()
        fvalue = field.value.strip()
        if "name" in fname:
            name = fvalue
        elif "mutation" in fname:
            mutation = fvalue
        elif "generation" in fname:  # Generation ($ PER SECOND)
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
            script = strip_code_block(fvalue)
            m = re.search(r'TeleportToPlaceInstance\((\d+),\s*"([\w-]+)', script)
            if m:
                placeId = m.group(1)
                jobId2 = m.group(2)
                # Prefer directly parsed JobId from script if not found above
                if not jobId and jobId2:
                    jobId = jobId2
        # You can also extract from "Join Link" if needed

    if players and (3 <= players["current"] <= 7):
        if name and jobId and placeId:
            return {
                "name": name,
                "mutation": mutation or "",
                "dps": dps or "",
                "tier": tier or "",
                "players": f'{players["current"]}/{players["max"]}',
                "jobId": jobId,
                "placeId": placeId,
                "timestamp": discord.utils.utcnow().timestamp(),
            }
    return None

class PetClient(discord.Client):
    async def on_ready(self):
        print(f'Logged in as {self.user}')

    async def on_message(self, message):
        if message.channel.id != CHANNEL_ID:
            return

        for embed in message.embeds:
            pet = parse_pet_embed(embed)
            if pet:
                if not any(p["jobId"] == pet["jobId"] and p["name"] == pet["name"] for p in pet_servers):
                    pet_servers.append(pet)
                    print(f"Added pet: {pet['name']} {pet['jobId']} {pet['players']}")
                if len(pet_servers) > 20:
                    pet_servers.pop(0)
                break

@app.route('/recent-pets')
def recent_pets():
    import time
    now = time.time()
    filtered = [p for p in pet_servers if now - p["timestamp"] < 900]
    # Optionally: you can add "time_found_ago" to each pet
    for p in filtered:
        p["time_found_ago"] = int(now - p["timestamp"])
    return jsonify(filtered)

def run_flask():
    app.run(host='0.0.0.0', port=8080)

if __name__ == "__main__":
    Thread(target=run_flask, daemon=True).start()
    intents = discord.Intents.default()
    intents.message_content = True
    client = PetClient(intents=intents)
    client.run(DISCORD_TOKEN)
