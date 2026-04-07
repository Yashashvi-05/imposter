# 🕵️ Imposter — Multiplayer Party Game

A real-time multiplayer party game where one player gets a secretly different word. Can you spot the imposter before they fool everyone?

**No app download needed** — just open a browser and share the link.

---

## 📸 How It Works

- Everyone joins the same room on their phone/laptop
- Each player sees a word for 5 seconds — **one player (the Imposter) gets a different word**
- Players take turns describing their word without saying it
- After describing, **any player can accuse someone** they think is the Imposter
- Find the Imposter → earn points. Imposter fools everyone → they score!

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)

### Run Locally

```bash
git clone https://github.com/YOUR_USERNAME/imposter-game.git
cd imposter-game/server
npm install
node index.js
```

The server starts on **port 3001**.

### Play on Local Network (Same WiFi)

1. Find your machine's local IP (e.g. `192.168.0.x`)
2. Everyone on the same WiFi opens: `http://192.168.0.x:3001`
3. One person creates a room, others join with the room code

---

## 🎮 Game Flow

```
Landing → Lobby → Word Flash (5s) → Playing → Round Over → Lobby ...
```

| Phase | What happens |
|---|---|
| **Lobby** | Host creates room, others join. Host sets round duration (3/5/8 min) |
| **Word Flash** | Your secret word appears for ~5 seconds. Memorize it! |
| **Playing** | Take turns describing your word. After you describe, the next person goes |
| **Accusing** | Any active player can accuse someone at any time by clicking their card |
| **Round Over** | Words revealed, scores updated, host can start another round |

---

## 📏 Rules

- **Minimum 4 players** required to start
- The **Imposter gets a slightly different word** (e.g. everyone has "Coffee", imposter has "Tea")
- When describing: **don't say the actual word** — give hints
- You have **2 chances** (4 players) or **3 chances** (5+ players) to accuse correctly
- **Self-accuse allowed** — if you're the Imposter, you can click yourself to reveal and score bonus points

---

## 🏆 Scoring

| Outcome | Points |
|---|---|
| Correctly found the Imposter | +2 pts |
| Imposter self-identified | +3 pts |
| Imposter survived the round | +2 pts |
| Missed / Eliminated | +0 pts |

Scores carry across rounds in the same session. A leaderboard appears in the lobby after round 1.

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
| `create-room` | Client → Server | Create a new game room |
| `join-room` | Client → Server | Join an existing room |
| `start-game` | Client → Server | Host starts the round |
| `send-message` | Client → Server | Send your description (auto-advances turn) |
| `submit-guess` | Client → Server | Accuse a player |
| `request-rematch` | Client → Server | Host starts a new round |
| `turn-changed` | Server → All | Notify who describes next |
| `new-message` | Server → All | Broadcast a description |
| `guess-result` | Server → Guesser | Private result of accusation |
| `players-updated` | Server → All | Updated player states |
| `round-over` | Server → All | Round results |

---

## 📱 Mobile Support

Fully responsive — works on phones, tablets, and desktops.

- Stacked layout on mobile (chat above player grid)
- 3-column player grid on small screens
- Compact game header hides non-essential labels
- Touch-friendly card buttons

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
