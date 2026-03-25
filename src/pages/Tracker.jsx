import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

export default function Tracker() {
    const navigate = useNavigate();
    const [totalWords, setTotalWords] = useState(0);
    const [stats, setStats] = useState({ totalAnswers: 0, correctAnswers: 0, accuracy: 0 });
    const [streakDates, setStreakDates] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    async function fetchDashboardData() {
        // 1. นับจำนวนคำศัพท์
        const { count: vocabCount } = await supabase
            .from('vocabularies')
            .select('*', { count: 'exact', head: true });

        if (vocabCount !== null) setTotalWords(vocabCount);

        // 2. ดึงสถิติ 
        // 🌟 แก้ปัญหาที่ 1: เพิ่ม .limit(10000) เพื่อทะลวงกำแพง 1000 แถวของ Supabase!
        const { data: statsData } = await supabase
            .from('daily_stats')
            .select('is_correct, created_at')
            .limit(10000);

        if (statsData) {
            // 🌟 แก้ปัญหาที่ 2: บังคับฟอร์แมตเวลาให้เป็น YYYY-MM-DD แบบเป๊ะๆ ไม่มีผิดเพี้ยน
            const localDates = statsData.map(item => {
                const d = new Date(item.created_at);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            });

            const total = statsData.length;
            const correct = statsData.filter(item => item.is_correct === true).length;
            const accuracyPercent = total > 0 ? Math.round((correct / total) * 100) : 0;

            setStats({ totalAnswers: total, correctAnswers: correct, accuracy: accuracyPercent });

            // 🌟 เอา localDates ด้านบนมาตัดตัวซ้ำออก แล้วใช้งานได้เลย!
            const uniqueDates = [...new Set(localDates)];
            setStreakDates(uniqueDates);
        }

        setLoading(false);
    }

    const tileClassName = ({ date, view }) => {
        if (view === 'month') {
            // 🌟 แปลงวันที่ของปฏิทินให้เป็น YYYY-MM-DD เพื่อให้หน้าตาเหมือนกัน 100%
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const calendarDateStr = `${year}-${month}-${day}`;

            if (streakDates.includes(calendarDateStr)) {
                return 'highlight-streak';
            }
        }
        return null;
    };

    if (loading) return <p style={{ textAlign: 'center', marginTop: '50px' }}>กำลังโหลดสถิติของคุณ...</p>;

    return (
        <div style={{ minHeight: '100vh' }}>
            <div className="page-header">
                <h1>Daily Tracker & Analytics</h1>
                <button className="btn-back" onClick={() => navigate('/')}>Back</button>
            </div>

            <div style={{ padding: '40px', display: 'flex', gap: '40px', justifyContent: 'center', flexWrap: 'wrap' }}>

                {/* กล่องซ้าย: ปฏิทิน (Calendar For Show Streaks) */}
                <div style={{ flex: '1', minWidth: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h3 style={{ marginBottom: '20px' }}>Calendar For Show Streaks</h3>
                    <div className="calendar-container">
                        <Calendar
                            tileClassName={tileClassName}
                            onClickDay={(value, event) => event.preventDefault()}
                        />
                    </div>
                    <p style={{ marginTop: '20px', fontSize: '1.2em' }}>
                        คลังคำศัพท์ปัจจุบัน: <strong>{totalWords}</strong> คำ
                    </p>
                </div>

                {/* กล่องขวา: สถิติความแม่นยำ */}
                <div style={{ flex: '1', minWidth: '350px', textAlign: 'center' }}>
                    <h3 style={{ marginBottom: '40px' }}>Stat For Show Accuracy</h3>

                    <div style={{ fontSize: '5em', fontWeight: 'bold', color: stats.accuracy >= 70 ? '#28a745' : '#dc3545' }}>
                        {stats.accuracy}%
                    </div>
                    <p style={{ color: '#666', marginTop: '10px', fontSize: '1.2em' }}>Percentage</p>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '50px', marginTop: '40px' }}>
                        <div>
                            <p style={{ color: '#666' }}>ตอบทั้งหมด</p>
                            <p style={{ fontSize: '1.8em', fontWeight: 'bold' }}>{stats.totalAnswers}</p>
                        </div>
                        <div>
                            <p style={{ color: '#666' }}>ตอบถูก</p>
                            <p style={{ fontSize: '1.8em', fontWeight: 'bold' }}>{stats.correctAnswers}</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}