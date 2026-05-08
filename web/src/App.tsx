import { GameShell, GameTopbar, GameAuth, useGameSounds } from "@freegamestore/games";
import { useLeaderboard } from "./hooks/useLeaderboard";
import { useCallback, useEffect, useRef, useState } from "react";

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Position = { x: number; y: number };

const GRID_SIZE = 20;
const INITIAL_SPEED = 150;
const SPEED_DECREASE = 5;
const MIN_SPEED = 50;

function getRandomPosition(snake: Position[]): Position {
  let pos: Position;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some((s) => s.x === pos.x && s.y === pos.y));
  return pos;
}

export default function App() {
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Direction>("RIGHT");
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);

  const directionRef = useRef<Direction>(direction);
  const snakeRef = useRef<Position[]>(snake);
  const foodRef = useRef<Position>(food);
  const scoreRef = useRef(score);
  const gameOverRef = useRef(gameOver);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const { submitScore } = useLeaderboard("snake");
  const submittedRef = useRef(false);
  const sounds = useGameSounds();
  const soundsRef = useRef(sounds);
  soundsRef.current = sounds;

  directionRef.current = direction;
  snakeRef.current = snake;
  foodRef.current = food;
  scoreRef.current = score;
  gameOverRef.current = gameOver;

  // Submit score on game over
  useEffect(() => {
    if (gameOver && !submittedRef.current) {
      submittedRef.current = true;
      submitScore(score);
    }
    if (!gameOver) {
      submittedRef.current = false;
    }
  }, [gameOver, score, submitScore]);

  const resetGame = useCallback(() => {
    const initialSnake = [{ x: 10, y: 10 }];
    setSnake(initialSnake);
    setFood(getRandomPosition(initialSnake));
    setDirection("RIGHT");
    setScore(0);
    setGameOver(false);
    setStarted(true);
  }, []);

  const changeDirection = useCallback((newDir: Direction) => {
    const current = directionRef.current;
    if (
      (newDir === "UP" && current !== "DOWN") ||
      (newDir === "DOWN" && current !== "UP") ||
      (newDir === "LEFT" && current !== "RIGHT") ||
      (newDir === "RIGHT" && current !== "LEFT")
    ) {
      setDirection(newDir);
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") changeDirection("UP");
      else if (e.key === "ArrowDown") changeDirection("DOWN");
      else if (e.key === "ArrowLeft") changeDirection("LEFT");
      else if (e.key === "ArrowRight") changeDirection("RIGHT");

      if (!started || gameOver) {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
          resetGame();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [changeDirection, started, gameOver, resetGame]);

  // Touch swipe controls
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      }
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      if (!touch || !touchStartRef.current) return;
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (Math.max(absDx, absDy) < 30) return;
      if (absDx > absDy) {
        changeDirection(dx > 0 ? "RIGHT" : "LEFT");
      } else {
        changeDirection(dy > 0 ? "DOWN" : "UP");
      }
    };
    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [changeDirection]);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Game loop
  useEffect(() => {
    if (!started || gameOver || paused) return;

    const speed = Math.max(MIN_SPEED, INITIAL_SPEED - score * SPEED_DECREASE);
    const interval = setInterval(() => {
      if (gameOverRef.current || pausedRef.current) return;

      const currentSnake = snakeRef.current;
      const head = currentSnake[0];
      if (!head) return;

      let newHead: Position;
      switch (directionRef.current) {
        case "UP":
          newHead = { x: head.x, y: head.y - 1 };
          break;
        case "DOWN":
          newHead = { x: head.x, y: head.y + 1 };
          break;
        case "LEFT":
          newHead = { x: head.x - 1, y: head.y };
          break;
        case "RIGHT":
          newHead = { x: head.x + 1, y: head.y };
          break;
      }

      // Check wall collision
      if (
        newHead.x < 0 ||
        newHead.x >= GRID_SIZE ||
        newHead.y < 0 ||
        newHead.y >= GRID_SIZE
      ) {
        soundsRef.current.playGameOver();
        setGameOver(true);
        return;
      }

      // Check self collision
      if (currentSnake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
        soundsRef.current.playGameOver();
        setGameOver(true);
        return;
      }

      const currentFood = foodRef.current;
      const ate = newHead.x === currentFood.x && newHead.y === currentFood.y;
      const newSnake = [newHead, ...currentSnake];
      if (!ate) {
        newSnake.pop();
      } else {
        const newScore = scoreRef.current + 1;
        setScore(newScore);
        setFood(getRandomPosition(newSnake));
        soundsRef.current.playScore();
      }
      setSnake(newSnake);
    }, speed);

    return () => clearInterval(interval);
  }, [started, gameOver, paused, score]);

  return (
    <GameShell
      topbar={
        <GameTopbar
          title="Snake"
          score={score}
          rules={
            <div>
              <h3 style={{marginBottom:'0.5rem',fontWeight:700}}>Snake</h3>
              <p>Eat food to grow your snake as long as you can.</p>
              <h4 style={{marginTop:'0.75rem',fontWeight:600}}>Controls</h4>
              <ul style={{paddingLeft:'1.2rem',marginTop:'0.25rem'}}>
                <li>Arrow keys to change direction</li>
                <li>Swipe on mobile</li>
              </ul>
              <h4 style={{marginTop:'0.75rem',fontWeight:600}}>Rules</h4>
              <ul style={{paddingLeft:'1.2rem',marginTop:'0.25rem'}}>
                <li>Don't hit the walls or yourself</li>
                <li>Speed increases as you eat more</li>
              </ul>
            </div>
          }
          onPlayPause={started && !gameOver ? () => setPaused(p => !p) : undefined}
          paused={paused}
          onRestart={resetGame}
          actions={<GameAuth />}
        />
      }
    >
      <div className="relative w-full h-full flex flex-col items-center gap-4 justify-center">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
            width: "min(80vw, 400px)",
            height: "min(80vw, 400px)",
            border: "2px solid var(--line)",
            background: "var(--panel)",
          }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const x = i % GRID_SIZE;
            const y = Math.floor(i / GRID_SIZE);
            const isSnake = snake.some((s) => s.x === x && s.y === y);
            const isFood = food.x === x && food.y === y;
            return (
              <div
                key={i}
                style={{
                  background: isSnake
                    ? "var(--accent)"
                    : isFood
                      ? "#ef4444"
                      : "transparent",
                  borderRadius: isFood ? "50%" : isSnake ? "2px" : undefined,
                }}
              />
            );
          })}
        </div>

        {gameOver && (
          <div className="text-center">
            <p
              className="text-xl font-bold mb-2"
              style={{ color: "var(--error)", fontFamily: "Fraunces, serif" }}
            >
              Game Over!
            </p>
            <button
              onClick={resetGame}
              className="px-4 py-2 rounded font-semibold min-h-[2.75rem] min-w-[2.75rem]"
              style={{
                background: "var(--accent)",
                color: "var(--panel)",
              }}
            >
              Play Again
            </button>
          </div>
        )}

        {/* Mobile directional buttons */}
        <div className="grid grid-cols-3 gap-2 mt-4" style={{ width: "180px" }}>
          <div />
          <button
            onClick={() => changeDirection("UP")}
            className="p-3 rounded font-bold text-lg min-h-[2.75rem] min-w-[2.75rem]"
            style={{ background: "var(--line)", color: "var(--ink)" }}
          >
            ^
          </button>
          <div />
          <button
            onClick={() => changeDirection("LEFT")}
            className="p-3 rounded font-bold text-lg min-h-[2.75rem] min-w-[2.75rem]"
            style={{ background: "var(--line)", color: "var(--ink)" }}
          >
            &lt;
          </button>
          <button
            onClick={() => changeDirection("DOWN")}
            className="p-3 rounded font-bold text-lg min-h-[2.75rem] min-w-[2.75rem]"
            style={{ background: "var(--line)", color: "var(--ink)" }}
          >
            v
          </button>
          <button
            onClick={() => changeDirection("RIGHT")}
            className="p-3 rounded font-bold text-lg min-h-[2.75rem] min-w-[2.75rem]"
            style={{ background: "var(--line)", color: "var(--ink)" }}
          >
            &gt;
          </button>
        </div>
      </div>
    </GameShell>
  );
}
