import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar'; // 🌟 โหลดตัวปฏิทินมาใช้
import 'react-calendar/dist/Calendar.css'; // 🌟 โหลดสไตล์พื้นฐานของปฏิทิน

export default function Tracker() {
    const navigate = useNavigate();
    const [totalWords, setTotalWords] = useState(0);
    const [stats, setStats] = useState({ totalAnswers: 0, correctAnswers: 0, accuracy: 0 });
    const [streakDates, setStreakDates] = useState([]); // 🌟 ตัวแปรเก็บ "วันที่" ที่เข้ามาเล่น
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

        // 2. ดึงข้อมูลประวัติการทำควิซ (ดึงมาเก็บไว้ใน State ก่อน)
        const { data: statsData } = await supabase
            .from('daily_stats')
            .select('is_correct, created_at');

        if (statsData) {
            setAllStatsData(statsData); // เก็บข้อมูลทั้งหมดไว้เผื่อเปลี่ยน Filter

            // จัดการข้อมูลปฏิทิน (ปฏิทินแสดงทั้งหมดเสมอ จะได้เห็นว่าวันไหนเข้ามาเล่นบ้าง)
            const localDates = statsData.map(item => {
                const d = new Date(item.created_at);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            });
            const uniqueDates = [...new Set(localDates)];
            setStreakDates(uniqueDates);

            // คำนวณสถิติครั้งแรกตาม timeframe ปัจจุบัน (week)
            calculateStats(statsData, timeframe);
        }

        setLoading(false);
    }

    // 🌟 ฟังก์ชันคำนวณสถิติแบบอัจฉริยะ (กรองตามเวลา)
    function calculateStats(data, selectedTimeframe) {
        let filteredData = data;
        const now = new Date();
        const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];

        // กรองข้อมูลตามที่เลือก
        if (selectedTimeframe === 'today') {
            filteredData = data.filter(item => {
                const itemDateStr = new Date(new Date(item.created_at).getTime() - new Date(item.created_at).getTimezoneOffset() * 60000).toISOString().split('T')[0];
                return itemDateStr === todayStr;
            });
        } else if (selectedTimeframe === 'week') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(now.getDate() - 7);
            filteredData = data.filter(item => new Date(item.created_at) >= sevenDaysAgo);
        } else if (selectedTimeframe === 'month') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);
            filteredData = data.filter(item => new Date(item.created_at) >= thirtyDaysAgo);
        }
        // ถ้าเป็น 'all' ก็ไม่ต้อง filter อะไร

        const total = filteredData.length;
        const correct = filteredData.filter(item => item.is_correct === true).length;
        const accuracyPercent = total > 0 ? Math.round((correct / total) * 100) : 0;

        setStats({ totalAnswers: total, correctAnswers: correct, accuracy: accuracyPercent });
    }

    const tileClassName = ({ date, view }) => {
        if (view === 'month') {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const calendarDateStr = `${year}-${month}-${day}`;

            if (streakDates.includes(calendarDateStr)) {
                return 'streak-day';
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
                    {/* เรียกใช้ปฏิทินตรงนี้ */}
                    <div className="calendar-container">
                        <Calendar
                            tileClassName={tileClassName}
                            // ปิดไม่ให้กดเลือกวันที่ได้ เพราะเราแค่ใช้ดูสถิติ
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