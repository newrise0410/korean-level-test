import { useRoute } from './lib/router';
import { getSettings } from './lib/store';
import Admin from './pages/Admin';
import Home from './pages/Home';
import Result from './pages/Result';
import Test from './pages/Test';

export default function App() {
  const r = useRoute();
  const isAdmin = r[0] === 'admin';
  let page;
  if (r[0] === 'test') page = <Test />;
  else if (r[0] === 'result' && r[1]) page = <Result id={r[1]} />;
  else if (isAdmin) page = <Admin sub={r.slice(1)} />;
  else page = <Home />;

  return (
    <div className="app">
      <header className="top">
        <a href="#/" className="logo"><span className="mark">한</span>한국어 레벨테스트</a>
        <span className="inst">{getSettings().institution}</span>
        <a href={isAdmin ? '#/' : '#/admin'} className="admin-link">{isAdmin ? '응시 화면' : '관리자'}</a>
      </header>
      <main>{page}</main>
    </div>
  );
}
