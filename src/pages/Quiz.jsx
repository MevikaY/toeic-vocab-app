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

    // 🌟 State ใหม่สำหรับควบคุมโหมดการฝึกซ้อม (false = Daily Cap, true = Practice All)
    const [isEndlessMode, setIsEndlessMode] = useState(false);

    useEffect(() => {
        fetchWordsAndStats();
    }, []);

    // เมื่อเปลี่ยน Filter ให้ดึงคำถามใหม่ (ถ้ายังไม่ถึงลิมิต หรืออยู่ในโหมด Practice All)
    useEffect(() => {
        if (vocabList.length > 0) {
            if (isEndlessMode || practicedToday < dailyTarget) {
                generateQuestion(vocabList, selectedCategory, selectedPOS);
            }
        }
    }, [selectedCategory, selectedPOS]);

    // 🌟 ตรวจจับการสลับโหมด ถ้าเปลี่ยนเป็น Practice All ให้สุ่มโจทย์ขึ้นมาทันที
    useEffect(() => {
        if (vocabList.length > 0) {
            if (isEndlessMode && !currentQuestion) {
                setMessage('');
                generateQuestion(vocabList, selectedCategory, selectedPOS);
            } else if (!isEndlessMode && practicedToday >= dailyTarget) {
                setCurrentQuestion(null);
                setMessage('🎉 ยินดีด้วย! คุณฝึกคำศัพท์ครบเป้าหมาย 50% ของวันนี้แล้วครับ (สามารถสลับเป็นโหมด Practice All เพื่อฝึกต่อได้)');
            }
        }
    }, [isEndlessMode]);

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

            // 🌟 เช็คโหมดก่อนเริ่มเกม
            if (currentPracticed < Math.ceil(cleanData.length / 2) || isEndlessMode) {
                generateQuestion(cleanData, 'All', 'All');
            } else {
                setMessage('🎉 ยินดีด้วย! คุณฝึกคำศัพท์ครบเป้าหมาย 50% ของวันนี้แล้วครับ (สามารถสลับเป็นโหมด Practice All เพื่อฝึกต่อได้)');
            }
        }
    }

    function generateQuestion(allWords, filterCat, filterPOS) {
        let filteredWords = allWords;

        if (filterCat !== 'All') {
            filteredWords = filteredWords.filter(w => w.category === filterCat);
        }

        if ((filterCat === 'All' || filterCat === 'Word') && filterPOS !== 'All') {
            filteredWords = filteredWords.filter(w => w.part_of_speech === filterPOS);
        }

        if (filteredWords.length < 4) {
            setCurrentQuestion(null);
            setMessage(`หมวดหมู่นี้มีข้อมูลไม่ถึง 4 คำ (มีแค่ ${filteredWords.length} คำ) ไปเพิ่มข้อมูลก่อนนะครับ!`);
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

        // 🌟 เช็คว่าควรหยุดเกมไหม (ถ้าถึงลิมิต และไม่ได้เปิดโหมด Endless)
        setTimeout(() => {
            if (newPracticedCount >= dailyTarget && !isEndlessMode) {
                setCurrentQuestion(null);
                setMessage('🎉 ยินดีด้วย! คุณฝึกคำศัพท์ครบเป้าหมาย 50% ของวันนี้แล้วครับ (สามารถสลับเป็นโหมด Practice All เพื่อฝึกต่อได้)');
            } else {
                generateQuestion(vocabList, selectedCategory, selectedPOS);
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

                {/* 🌟 ปุ่มสลับโหมดการฝึกซ้อม */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '25px' }}>
                    <button
                        onClick={() => setIsEndlessMode(false)}
                        style={{
                            padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease',
                            border: '2px solid #0056b3',
                            backgroundColor: !isEndlessMode ? '#0056b3' : '#ffffff',
                            color: !isEndlessMode ? '#ffffff' : '#0056b3'
                        }}
                    >
                        🎯 Daily Goal (50%)
                    </button>
                    <button
                        onClick={() => setIsEndlessMode(true)}
                        style={{
                            padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease',
                            border: '2px solid #28a745',
                            backgroundColor: isEndlessMode ? '#28a745' : '#ffffff',
                            color: isEndlessMode ? '#ffffff' : '#28a745'
                        }}
                    >
                        ♾️ Practice All
                    </button>
                </div>

                {/* กล่องแสดงสถานะ จะเปลี่ยนสีและข้อความตามโหมดที่เลือก */}
                <div style={{
                    marginBottom: '20px', padding: '15px', borderRadius: '8px', fontWeight: 'bold',
                    backgroundColor: isEndlessMode ? '#d4edda' : '#f0f8ff',
                    color: isEndlessMode ? '#155724' : '#0056b3'
                }}>
                    {isEndlessMode
                        ? `♾️ โหมดฝึกซ้อมทั้งหมด: ทำไปแล้ว ${practicedToday} ข้อในวันนี้`
                        : `🎯 เป้าหมายวันนี้: ทำไปแล้ว ${practicedToday} / ${dailyTarget} ข้อ`
                    }
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