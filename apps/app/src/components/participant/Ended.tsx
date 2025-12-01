function Ended() {
  return (
    <section className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-ink-200 bg-white p-10 text-center shadow-sm">
      <h2 className="text-2xl font-semibold">Time's up!</h2>
      <p className="text-sm text-ink-600">
        Thank you for participating. Your found poem has been captured.
      </p>
    </section>
  );
}

export default Ended;
