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

        // 2. ดึงสถิติ และ ดึงวันที่ (created_at) มาด้วย
        const { data: statsData } = await supabase
            .from('daily_stats')
            .select('is_correct, created_at');

        if (statsData) {
            // 🌟 แก้ปัญหา Timezone: แปลงเวลา UTC ให้เป็นเวลาเครื่องของผู้ใช้ และเก็บในรูปแบบ en-CA เป๊ะๆ
            const localDates = statsData.map(item => {
                const dateObj = new Date(item.created_at);
                // ใช้ 'en-CA' locale เพื่อให้ได้รูปแบบ YYYY-MM-DD (เช่น '2026-03-25') ตามเวลาท้องถิ่น
                return dateObj.toLocaleDateString('en-CA');
            });

            const total = statsData.length;
            const correct = statsData.filter(item => item.is_correct === true).length;
            const accuracyPercent = total > 0 ? Math.round((correct / total) * 100) : 0;

            setStats({ totalAnswers: total, correctAnswers: correct, accuracy: accuracyPercent });

            // 🌟 เอา localDates ที่มีรูปแบบ YYYY-MM-DD มาตัดวันซ้ำออก
            const uniqueDates = [...new Set(localDates)];
            setStreakDates(uniqueDates); // เก็บสตริงรูปแบบ YYYY-MM-DD ไว้ใช้งาน
        }

        setLoading(false);
    }

    // 🌟 ฟังก์ชันสำหรับเช็คว่า ปฏิทินช่องไหนตรงกับวันที่เราเคยเล่น ให้เติมคลาส CSS สีเขียวเข้าไป
    const tileClassName = ({ date, view }) => {
        if (view === 'month') {
            // แปลงวันที่ของช่องปฏิทินให้เป็น YYYY-MM-DD แบบ local time เพื่อให้หน้าตาเหมือนกัน 100%
            const calendarDateStr = date.toLocaleDateString('en-CA');

            // ตอนนี้ทั้ง streakDates และ calendarDateStr มีรูปแบบเดียวกัน (YYYY-MM-DD) การเปรียบเทียบนี้จะทำงานได้อย่างถูกต้อง
            if (streakDates.includes(calendarDateStr)) {
                return 'highlight-streak'; // ชื่อคลาสสีเขียวในไฟล์ CSS ของคุณ
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