export function EntryForm({ onDone, onCancel }: { onDone: (id: string) => void; onCancel: () => void }) {
  return <><button onClick={() => onDone(window.fixture.savedId)}>שמירה מדומה</button><button onClick={onCancel}>סגירה מדומה</button></>;
}
