import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

export default function Tracker() {
    const navigate = useNavigate();
    const [totalWords, setTotalWords] = useState(0);
    const [allStatsData, setAllStatsData] = useState([]); // เก็บข้อมูลดิบทั้งหมด
    const [stats, setStats] = useState({ totalAnswers: 0, correctAnswers: 0, accuracy: 0 });
    const [streakDates, setStreakDates] = useState([]);
    const [loading, setLoading] = useState(true);

    // 🌟 State ใหม่สำหรับเลือกช่วงเวลา (ค่าเริ่มต้นคือ 'week' = สัปดาห์นี้)
    const [timeframe, setTimeframe] = useState('week');

    useEffect(() => {
        fetchDashboardData();
    }, []);

    // 🌟 เมื่อเปลี่ยน Dropdown ช่วงเวลา ให้คำนวณสถิติใหม่ทันที
    useEffect(() => {
        if (allStatsData.length > 0) {
            calculateStats(allStatsData, timeframe);
        }
    }, [timeframe, allStatsData]);

    async function fetchDashboardData() {
        // 1. นับจำนวนคำศัพท์
        const { count: vocabCount } = await supabase
            .from('vocabularies')
            .select('*', { count: 'exact', head: true });

        if (vocabCount !== null) setTotalWords(vocabCount);

        // 2. ดึงข้อมูลประวัติการทำควิซ (ดึงมาเก็บไว้ใน State ก่อน)
        const { data: statsData } = await supabase
            .from('daily_stats')
            .select('is_correct, created_at')
            .limit(10000);

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

                {/* กล่องซ้าย: ปฏิทิน (คงเดิม) */}
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

                {/* กล่องขวา: สถิติความแม่นยำ พร้อมตัวกรองเวลา */}
                <div style={{ flex: '1', minWidth: '350px', textAlign: 'center', backgroundColor: '#fff', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                        <h3 style={{ margin: 0 }}>Stat For Show Accuracy</h3>

                        {/* 🌟 Dropdown เลือกช่วงเวลา */}
                        <select
                            value={timeframe}
                            onChange={(e) => setTimeframe(e.target.value)}
                            style={{ padding: '8px 15px', borderRadius: '8px', border: '1px solid #ccc', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            <option value="today">วันนี้</option>
                            <option value="week">7 วันล่าสุด</option>
                            <option value="month">30 วันล่าสุด</option>
                            <option value="all">ตั้งแต่เริ่มต้น</option>
                        </select>
                    </div>

                    <div style={{ fontSize: '6em', fontWeight: 'bold', color: stats.accuracy >= 70 ? '#28a745' : (stats.accuracy >= 50 ? '#ffc107' : '#dc3545'), transition: 'color 0.3s ease' }}>
                        {stats.accuracy}%
                    </div>
                    <p style={{ color: '#666', marginTop: '0px', fontSize: '1.2em' }}>Percentage</p>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '50px', marginTop: '40px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '12px' }}>
                        <div>
                            <p style={{ color: '#666', marginBottom: '5px' }}>ตอบทั้งหมด</p>
                            <p style={{ fontSize: '2em', fontWeight: 'bold', margin: 0 }}>{stats.totalAnswers}</p>
                        </div>
                        <div>
                            <p style={{ color: '#666', marginBottom: '5px' }}>ตอบถูก</p>
                            <p style={{ fontSize: '2em', fontWeight: 'bold', margin: 0, color: '#28a745' }}>{stats.correctAnswers}</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}