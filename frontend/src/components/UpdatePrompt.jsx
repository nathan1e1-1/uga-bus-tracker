export function UpdatePrompt({ needRefresh, onReload }) {
  if (!needRefresh) return null;
  return (
    <div className="update-prompt" role="status">
      <span>New version available</span>
      <button onClick={onReload} className="update-prompt-btn">
        Reload
      </button>
    </div>
  );
}