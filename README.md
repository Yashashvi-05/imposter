# 🕵️ Imposter — Multiplayer Party Game

A real-time multiplayer party game where one player gets a secretly different word. Can you spot the imposter before they fool everyone?

**No app download needed** — just open a browser and share the link.

---

## 📸 How It Works

- Everyone joins the same room on phone/laptop
- Each player sees a secret word for **4-5 seconds** (no role label shown)
- One player gets the odd word (Imposter) and does not know they are imposter
- Players describe in turn order with a **45-second turn timer**
- Any active player can accuse via player grid (mobile has a dedicated `Accuse` button)

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)

### Run Locally

```bash
git clone https://github.com/Yashashvi-05/imposter.git
cd imposter/server
npm install
node index.js
```

The server starts on **port 3001**.

### Play on Local Network (Same WiFi)

1. Start the server and open it on your laptop browser
2. In lobby, share the generated **join link** or **QR code**
3. Others on the same WiFi can join directly from mobile

---

## 🎮 Game Flow

```
Landing → Lobby → Word Flash (4-5s) → Playing → Round Over → Lobby ...
```

| Phase | What happens |
|---|---|
| **Lobby** | Host creates room, others join. Host sets duration (3/5/8 min) and can share URL/QR |
| **Word Flash** | Secret word appears for random 4-5 seconds, then hides |
| **Playing** | Turn-based describing with 45s turn timeout auto-skip |
| **Accusing** | Any active player can accuse (1 chance each). Wrong guess eliminates active play |
| **Round Over** | Words/results shown, latest-round + total scores updated |

---

## 📏 Rules

- **Minimum 4 players** required to start (host test mode can lower min for testing)
- The imposter word is now drawn from a **different category** than the crew word
- When describing: **don't say the actual word** — give hints
- Every player has **1 accuse chance** per round
- Wrong guess => eliminated from active play, but still remains in room as spectator/chat
- **Self-accuse allowed** — if you're the imposter, you can click yourself to reveal and score bonus points
- Round ends immediately if all crewmates correctly find the imposter

---

## 🏆 Scoring

| Outcome | Points |
|---|---|
| Correctly found the Imposter | +2 pts |
| Imposter self-identified | +3 pts |
| Imposter survived the round | +2 pts |
| Missed / Eliminated | +0 pts |

Scores carry across rounds in the same session.

- **Leaderboard**: cumulative points across rounds
- **Latest Game Score**: points earned in the most recent round

---

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| Server | Node.js + Express |
| Real-time | Socket.io |
| Client | Vanilla HTML + CSS + JavaScript |
| Styling | Pure CSS (no frameworks) |

**Zero client-side dependencies** — no React, no bundler, no build step. The server serves 3 static files directly.

---

## 📁 Project Structure

```
imposter-game/
└── server/
    ├── index.js              # Express + Socket.io entry point
    ├── gameManager.js        # All game state & logic
    ├── socketHandlers.js     # Socket event handlers
    ├── validation.js         # Message validation
    ├── words.js              # Word pairs database
    ├── package.json
    └── public/               # Client (served as static files)
        ├── index.html        # All 5 game screens
        ├── style.css         # Light theme + mobile responsive
        └── game.js           # All client-side game logic
```

---

## ⚙️ Configuration

You can edit `server/words.js` to add your own word pairs:

```js
// Format: { crew: "what everyone sees", imposter: "what the imposter sees" }
{ crew: "Coffee", imposter: "Tea" },
{ crew: "Football", imposter: "Rugby" },
```

---

## 🔌 Socket Events Reference

| Event | Direction | Description |
|---|---|---|
| `create-room` | Client → Server | Create a game room |
| `join-room` | Client → Server | Join room (mid-game joins as spectator) |
| `reconnect-room` | Client → Server | Restore player session after disconnect |
| `leave-room` | Client → Server | Voluntarily leave room immediately |
| `start-game` | Client → Server | Host starts round |
| `send-message` | Client → Server | Send turn-based description |
| `send-personal-chat` | Client → Server | Send group chat message (all players) |
| `submit-guess` | Client → Server | Accuse selected player |
| `request-rematch` | Client → Server | Host resets to lobby for next round |
| `turn-changed` | Server → All | Next describing player |
| `turn-tick` | Server → All | Per-turn countdown updates |
| `turn-timed-out` | Server → All | Current turn auto-skipped |
| `new-message` | Server → All | Description feed message |
| `new-personal-chat` | Server → All | Group chat message |
| `guess-result` | Server → Guesser | Private accuse result |
| `players-updated` | Server → All | Player state sync |
| `round-over` | Server → All | Round results payload |

---

## 📱 Mobile Support

Fully responsive — works on phones, tablets, and desktops.

- Join via lobby URL/QR sharing
- Mobile `Accuse` button opens player selection modal
- Group chat modal available to active/eliminated/spectator users
- Reconnect status shown when a player temporarily disconnects

---

## 🤝 Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/my-feature`
3. Commit: `git commit -m "Add my feature"`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

*Built with ❤️ as a party game for friends on the same WiFi.*
