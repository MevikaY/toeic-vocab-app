import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Quiz() {
    const navigate = useNavigate();
    const [vocabList, setVocabList] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [choices, setChoices] = useState([]);
    const [score, setScore] = useState(0);
    const [message, setMessage] = useState('');

    const [selectedCategory, setSelectedCategory] = useState('All');
    const [availableCategories, setAvailableCategories] = useState([]);
    const [selectedPOS, setSelectedPOS] = useState('All');
    const [availablePOS, setAvailablePOS] = useState([]);

    const [dailyTarget, setDailyTarget] = useState(0);
    const [practicedToday, setPracticedToday] = useState(0);

    // 🌟 State ใหม่! เปลี่ยนมาใช้ตัวแปรเดียวเพื่อควบคุม 3 โหมด ('daily', 'all', 'today')
    const [quizMode, setQuizMode] = useState('daily');

    useEffect(() => {
        fetchWordsAndStats();
    }, []);

    // 🌟 เมื่อเปลี่ยนโหมด หรือเปลี่ยนฟิลเตอร์ ให้ดึงคำถามใหม่ทันที
    useEffect(() => {
        if (vocabList.length > 0) {
            if (quizMode === 'daily' && practicedToday >= dailyTarget) {
                setCurrentQuestion(null);
                setMessage('🎉 ยินดีด้วย! คุณฝึกคำศัพท์ครบเป้าหมาย 50% ของวันนี้แล้วครับ (เลือกโหมดอื่นด้านบนเพื่อฝึกต่อได้เลย)');
            } else {
                generateQuestion(vocabList, selectedCategory, selectedPOS, quizMode);
            }
        }
    }, [selectedCategory, selectedPOS, quizMode]);

    async function fetchWordsAndStats() {
        const { data: wordsData, error: wordsError } = await supabase.from('vocabularies').select('*');

        if (!wordsError && wordsData) {
            const cleanData = wordsData.map(item => ({
                ...item,
                category: item.category || 'Word'
            }));

            setVocabList(cleanData);
            setDailyTarget(Math.ceil(cleanData.length / 2));

            const catList = [...new Set(cleanData.map(item => item.category))].filter(Boolean);
            setAvailableCategories(catList);

            const posList = [...new Set(cleanData.map(item => item.part_of_speech))].filter(Boolean);
            setAvailablePOS(posList);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { count: todayCount } = await supabase
                .from('daily_stats')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', today.toISOString());

            const currentPracticed = todayCount || 0;
            setPracticedToday(currentPracticed);

            if (currentPracticed < Math.ceil(cleanData.length / 2)) {
                generateQuestion(cleanData, 'All', 'All', 'daily');
            } else {
                setMessage('🎉 ยินดีด้วย! คุณฝึกคำศัพท์ครบเป้าหมาย 50% ของวันนี้แล้วครับ (เลือกโหมดอื่นด้านบนเพื่อฝึกต่อได้เลย)');
            }
        }
    }

    // 🌟 ฟังก์ชันสุ่มคำถามที่ฉลาดขึ้น (รองรับโหมด Today)
    function generateQuestion(allWords, filterCat, filterPOS, currentMode) {
        let filteredWords = allWords;

        // 🌟 ด่านที่ 0: ถ้าเลือกโหมด Today ให้กรองเฉพาะคำที่เพิ่ม "วันนี้"
        if (currentMode === 'today') {
            const todayString = new Date().toDateString(); // ดึงวันที่ปัจจุบัน
            filteredWords = filteredWords.filter(w => new Date(w.created_at).toDateString() === todayString);
        }

        // ด่านที่ 1: กรองหมวดหมู่
        if (filterCat !== 'All') {
            filteredWords = filteredWords.filter(w => w.category === filterCat);
        }

        // ด่านที่ 2: กรอง POS
        if ((filterCat === 'All' || filterCat === 'Word') && filterPOS !== 'All') {
            filteredWords = filteredWords.filter(w => w.part_of_speech === filterPOS);
        }

        // เช็คว่ามีศัพท์พอให้สร้างช้อยส์ไหม (ต้องมีอย่างน้อย 4 คำ)
        if (filteredWords.length < 4) {
            setCurrentQuestion(null);
            if (currentMode === 'today') {
                setMessage(`วันนี้คุณเพิ่งเพิ่มข้อมูลหมวดนี้ไป ${filteredWords.length} คำ (ต้องมีอย่างน้อย 4 คำถึงจะเริ่มควิซได้ครับ) ไปหน้า Add Word ก่อนนะ!`);
            } else {
                setMessage(`หมวดหมู่นี้มีข้อมูลไม่ถึง 4 คำ (มีแค่ ${filteredWords.length} คำ) ไปเพิ่มข้อมูลก่อนนะครับ!`);
            }
            return;
        }

        const randomIndex = Math.floor(Math.random() * filteredWords.length);
        const questionWord = filteredWords[randomIndex];

        const distractors = filteredWords
            .filter((w) => w.id !== questionWord.id)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);

        const allChoices = [...distractors, questionWord].sort(() => 0.5 - Math.random());

        setCurrentQuestion(questionWord);
        setChoices(allChoices);
        setMessage('');
    }

    async function handleAnswer(selectedChoice) {
        const isCorrect = selectedChoice.id === currentQuestion.id;

        if (isCorrect) {
            setScore(score + 1);
            setMessage('✅ ถูกต้องครับ!');
        } else {
            setMessage(`❌ ผิดครับ! คำแปลคือ "${currentQuestion.translation}"`);
        }

        await supabase.from('daily_stats').insert([{ vocab_id: currentQuestion.id, is_correct: isCorrect }]);

        const newPracticedCount = practicedToday + 1;
        setPracticedToday(newPracticedCount);

        setTimeout(() => {
            // หยุดเกมถ้าโหมด Daily เป้าหมายครบแล้ว
            if (newPracticedCount >= dailyTarget && quizMode === 'daily') {
                setCurrentQuestion(null);
                setMessage('🎉 ยินดีด้วย! คุณฝึกคำศัพท์ครบเป้าหมาย 50% ของวันนี้แล้วครับ (เลือกโหมดอื่นด้านบนเพื่อฝึกต่อได้เลย)');
            } else {
                generateQuestion(vocabList, selectedCategory, selectedPOS, quizMode);
            }
        }, 2000);
    }

    return (
        <div style={{ minHeight: '100vh' }}>
            <div className="page-header">
                <h1>Vocabulary Quiz</h1>
                <button className="btn-back" onClick={() => navigate('/')}>Back</button>
            </div>

            <div style={{ maxWidth: '650px', margin: '40px auto', textAlign: 'center', backgroundColor: '#fff', padding: '40px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>

                {/* 🌟 3 ปุ่ม ควบคุมโหมดการเล่น */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setQuizMode('daily')}
                        style={{
                            padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease',
                            border: '2px solid #0056b3',
                            backgroundColor: quizMode === 'daily' ? '#0056b3' : '#ffffff',
                            color: quizMode === 'daily' ? '#ffffff' : '#0056b3'
                        }}
                    >
                        🎯 Daily Goal (50%)
                    </button>

                    <button
                        onClick={() => setQuizMode('all')}
                        style={{
                            padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease',
                            border: '2px solid #28a745',
                            backgroundColor: quizMode === 'all' ? '#28a745' : '#ffffff',
                            color: quizMode === 'all' ? '#ffffff' : '#28a745'
                        }}
                    >
                        ♾️ Practice All
                    </button>

                    {/* ปุ่มใหม่สีส้มสะดุดตา สำหรับโหมดศัพท์วันนี้ */}
                    <button
                        onClick={() => setQuizMode('today')}
                        style={{
                            padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease',
                            border: '2px solid #ff8c00',
                            backgroundColor: quizMode === 'today' ? '#ff8c00' : '#ffffff',
                            color: quizMode === 'today' ? '#ffffff' : '#ff8c00'
                        }}
                    >
                        ✨ Today's New Words
                    </button>
                </div>

                {/* 🌟 กล่องแสดงสถานะ เปลี่ยนสีตามโหมดที่เลือก */}
                <div style={{
                    marginBottom: '20px', padding: '15px', borderRadius: '8px', fontWeight: 'bold',
                    backgroundColor: quizMode === 'today' ? '#fff3cd' : (quizMode === 'all' ? '#d4edda' : '#f0f8ff'),
                    color: quizMode === 'today' ? '#856404' : (quizMode === 'all' ? '#155724' : '#0056b3')
                }}>
                    {quizMode === 'today' && `✨ โหมดศัพท์ใหม่: ทบทวนเฉพาะคำที่คุณเพิ่งเพิ่มเข้ามาในวันนี้`}
                    {quizMode === 'all' && `♾️ โหมดฝึกซ้อมทั้งหมด: ทำไปแล้ว ${practicedToday} ข้อในวันนี้`}
                    {quizMode === 'daily' && `🎯 เป้าหมายวันนี้: ทำไปแล้ว ${practicedToday} / ${dailyTarget} ข้อ`}
                </div>

                {/* ส่วน Filter Category และ POS */}
                <div style={{ marginBottom: '30px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '20px', backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '12px' }}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label style={{ fontWeight: 'bold' }}>Category:</label>
                        <select
                            value={selectedCategory}
                            onChange={(e) => {
                                setSelectedCategory(e.target.value);
                                if (e.target.value !== 'Word' && e.target.value !== 'All') {
                                    setSelectedPOS('All');
                                }
                            }}
                            style={{ padding: '8px 15px', borderRadius: '8px', border: '1px solid #ccc', cursor: 'pointer' }}
                        >
                            <option value="All">All Categories</option>
                            {availableCategories.map((cat, index) => (
                                <option key={index} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label style={{ fontWeight: 'bold', color: (selectedCategory !== 'Word' && selectedCategory !== 'All') ? '#aaa' : '#000' }}>
                            Part of Speech:
                        </label>
                        <select
                            value={selectedPOS}
                            onChange={(e) => setSelectedPOS(e.target.value)}
                            disabled={selectedCategory !== 'Word' && selectedCategory !== 'All'}
                            style={{
                                padding: '8px 15px', borderRadius: '8px', border: '1px solid #ccc',
                                cursor: (selectedCategory !== 'Word' && selectedCategory !== 'All') ? 'not-allowed' : 'pointer',
                                backgroundColor: (selectedCategory !== 'Word' && selectedCategory !== 'All') ? '#f0f0f0' : '#fff',
                                color: (selectedCategory !== 'Word' && selectedCategory !== 'All') ? '#aaa' : '#000'
                            }}
                        >
                            <option value="All">All Types</option>
                            {availablePOS.map((pos, index) => (
                                <option key={index} value={pos}>{pos}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <p style={{ fontSize: '1.2em' }}>คะแนนของคุณ: <strong style={{ fontSize: '1.5em' }}>{score}</strong></p>

                {currentQuestion ? (
                    <div style={{ marginTop: '30px' }}>
                        <h3 style={{ fontSize: '2.5em', color: '#333' }}>
                            {currentQuestion.word}
                            <span style={{ fontSize: '0.4em', color: '#666', display: 'block', marginTop: '5px' }}>
                                ({currentQuestion.category} {currentQuestion.part_of_speech !== '-' && `- ${currentQuestion.part_of_speech}`})
                            </span>
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '30px' }}>
                            {choices.map((choice, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleAnswer(choice)}
                                    className="custom-btn"
                                    style={{ width: '100%', padding: '15px', fontSize: '1.2em', border: '1px solid #eee' }}
                                >
                                    {choice.translation}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#d4edda', color: '#155724', borderRadius: '8px', fontSize: '1.2em', fontWeight: 'bold' }}>
                        {message || 'กำลังโหลดข้อมูล...'}
                    </div>
                )}

                {message && currentQuestion && (
                    <div style={{ marginTop: '20px', padding: '15px', fontWeight: 'bold', fontSize: '1.2em', color: message.includes('✅') ? '#28a745' : '#dc3545' }}>
                        {message}
                    </div>
                )}
            </div>
        </div>
    );
}