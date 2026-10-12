import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROOM_CODE_LENGTH } from '../config/event';
import { isValidRoomCode, normaliseRoomCode } from '../lib/roomCode';

/** Small "enter your room code" form. Sends the player to /r/CODE. */
export default function RoomCodeForm() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValidRoomCode(code)) {
      setError(`Enter the ${ROOM_CODE_LENGTH}-character code from your organiser.`);
      return;
    }
    navigate(`/r/${code}`);
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="home-room-code">Room code</label>
        <input
          id="home-room-code"
          className="code-input"
          value={code}
          onChange={(e) => {
            setCode(normaliseRoomCode(e.target.value));
            setError(null);
          }}
          placeholder="ABC234"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'home-room-code-error' : undefined}
        />
        {error && (
          <span id="home-room-code-error" className="field__error" role="alert">
            {error}
          </span>
        )}
      </div>
      <button className="btn" type="submit">
        Join room
      </button>
    </form>
  );
}
