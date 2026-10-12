import { Link } from 'react-router-dom';
import RoomCodeForm from '../components/RoomCodeForm';
import SampleLot from '../components/SampleLot';
import { eventConfig, TO_BE_ANNOUNCED } from '../config/event';

const steps = [
  {
    title: 'The organiser opens a room',
    body: 'Sign in, set team budgets and bid rules, and add the lots.',
  },
  {
    title: 'Share the code or link',
    body: 'Every room has its own six-character code and invitation link.',
  },
  {
    title: 'Teams join and wait',
    body: 'Players enter a display name and team name. The organiser approves them.',
  },
  {
    title: 'Bid until the timer ends',
    body: 'The server keeps the clock and checks every bid against the team budget.',
  },
];

export default function Home() {
  const details = [
    { label: 'Organised by', value: eventConfig.organiserName },
    { label: 'Date', value: eventConfig.date },
    { label: 'Venue', value: eventConfig.venue },
    { label: 'Questions', value: eventConfig.contact },
  ];

  return (
    <>
      <section className="hero">
        <div className="wrap hero__grid">
          <div>
            <p className="hero__fest">{eventConfig.festName}</p>
            <h1 className="hero__title">{eventConfig.title}</h1>
            <p className="hero__lede">
              A live mock auction where teams spend a fixed budget against each other, one lot at a
              time. Join from your phone or computer with a room code.
            </p>

            <div className="plate hero__join">
              <h2>Join an auction room</h2>
              <RoomCodeForm />
            </div>
          </div>

          <SampleLot />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <h2>How a room runs</h2>
          </div>
          <ol className="steps">
            {steps.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <h2>Event details</h2>
            <p>The organiser fills these in. Anything not provided stays marked as to be announced.</p>
          </div>
          <dl className="details">
            {details.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd className={item.value ? undefined : 'is-empty'}>
                  {item.value ?? TO_BE_ANNOUNCED}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <h2>Running the auction?</h2>
            <p>Organisers sign in to create rooms, manage lots and watch bidding live.</p>
          </div>
          <Link to="/admin/login" className="btn btn--ghost">
            Organiser sign in
          </Link>
        </div>
      </section>
    </>
  );
}
