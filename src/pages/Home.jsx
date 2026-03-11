import { useNavigate } from 'react-router-dom';

export default function Home() {
    const navigate = useNavigate();

    return (
        <div className="home-container">
            {/* แถบเมนูด้านบนสุดเฉพาะหน้า Home */}
            <header className="home-header">
                <h1>TOEIC Vocabulary Training</h1>
                <div className="header-actions">
                    <span className="sign-in-text">Sign In</span>
                    <button className="mode-btn dark-btn">Dark Mode</button>
                    <button className="mode-btn light-btn">Light Mode</button>
                </div>
            </header>

            {/* พื้นที่หลักที่จะมีรูปภาพพื้นหลังและปุ่มเมนู */}
            <main className="home-main">
                <div className="menu-cards-container">

                    <div className="menu-card" onClick={() => navigate('/add-word')}>
                        <h2>Add Word</h2>
                    </div>

                    <div className="menu-card" onClick={() => navigate('/quiz')}>
                        <h2>Quiz</h2>
                    </div>

                    <div className="menu-card" onClick={() => navigate('/tracker')}>
                        <h2>Tracker</h2>
                    </div>

                </div>
            </main>
        </div>
    );
}