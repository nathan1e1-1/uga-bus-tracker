import App from './App.jsx';
import { usePwaUpdate } from './hooks/usePwaUpdate';
import { UpdatePrompt } from './components/UpdatePrompt';

export default function Root() {
  const { needRefresh, reload } = usePwaUpdate();
  return (
    <>
      <App />
      <UpdatePrompt needRefresh={needRefresh} onReload={reload} />
    </>
  );
}