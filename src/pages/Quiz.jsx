import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Quiz() {
    const navigate = useNavigate();
    const [vocabList, setVocabList] = useState([]);
    const [mainMode, setMainMode] = useState('choice');

    // ==========================================
    // 🌟 State ใหม่สำหรับจัดการ "คำซ้ำ" และ "ปุ่ม Next"
    // ==========================================
    const [answeredIdsToday, setAnsweredIdsToday] = useState([]); // เก็บ ID ของคำที่ตอบไปแล้ววันนี้
    const [isAnswered, setIsAnswered] = useState(false); // เช็คว่าตอบข้อนี้ไปหรือยัง (เพื่อโชว์ปุ่ม Next)

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
    const [quizMode, setQuizMode] = useState('daily');

    // State ของ Typing Mode
    const [typingSetup, setTypingSetup] = useState(true);
    const [typingLimit, setTypingLimit] = useState(10);
    const [typingQueue, setTypingQueue] = useState([]);
    const [typingIndex, setTypingIndex] = useState(0);
    const [typingInput, setTypingInput] = useState('');
    const [typingScore, setTypingScore] = useState(0);
    const [typingFeedback, setTypingFeedback] = useState(null);
    const inputRef = useRef(null);

    useEffect(() => {
        fetchWordsAndStats();
    }, []);

    useEffect(() => {
        if (mainMode === 'choice' && vocabList.length > 0) {
            if (quizMode === 'daily' && practicedToday >= dailyTarget) {
                setCurrentQuestion(null);
                setMessage('🎉 ยินดีด้วย! คุณฝึกคำศัพท์ครบเป้าหมาย 50% ของวันนี้แล้วครับ');
            } else {
                generateQuestion(vocabList, selectedCategory, selectedPOS, quizMode, answeredIdsToday);
            }
        }
    }, [selectedCategory, selectedPOS, quizMode, mainMode]);

    async function fetchWordsAndStats() {
        const { data: wordsData, error: wordsError } = await supabase.from('vocabularies').select('*');
        if (!wordsError && wordsData) {
            const cleanData = wordsData.map(item => ({ ...item, category: item.category || 'Word' }));
            setVocabList(cleanData);
            setDailyTarget(Math.ceil(cleanData.length / 2));
            setAvailableCategories([...new Set(cleanData.map(item => item.category))].filter(Boolean));
            setAvailablePOS([...new Set(cleanData.map(item => item.part_of_speech))].filter(Boolean));

            // 🌟 ดึงข้อมูลว่า "วันนี้" เราเคยตอบ ID ไหนไปแล้วบ้าง
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const { data: statsData } = await supabase
                .from('daily_stats')
                .select('vocab_id')
                .gte('created_at', today.toISOString());

            const answeredIds = statsData ? statsData.map(item => item.vocab_id) : [];
            setAnsweredIdsToday(answeredIds);
            setPracticedToday(answeredIds.length);

            if (answeredIds.length < Math.ceil(cleanData.length / 2)) {
                generateQuestion(cleanData, 'All', 'All', 'daily', answeredIds);
            } else {
                setMessage('🎉 ยินดีด้วย! คุณฝึกคำศัพท์ครบเป้าหมาย 50% ของวันนี้แล้วครับ');
            }
        }
    }

    // 🌟 อัปเกรดความฉลาด: สุ่มคำถามโดย "ไม่เอาคำที่ตอบไปแล้ววันนี้"
    function generateQuestion(allWords, filterCat, filterPOS, currentMode, currentAnsweredIds = []) {
        let filteredWords = allWords;

        if (currentMode === 'today') {
            const todayString = new Date().toDateString();
            filteredWords = filteredWords.filter(w => new Date(w.created_at).toDateString() === todayString);
        }
        if (filterCat !== 'All') filteredWords = filteredWords.filter(w => w.category === filterCat);
        if ((filterCat === 'All' || filterCat === 'Word') && filterPOS !== 'All') filteredWords = filteredWords.filter(w => w.part_of_speech === filterPOS);

        // 🌟 กรองคำที่ "ตอบไปแล้ววันนี้" ออกจากการเป็นโจทย์
        let candidateQuestions = filteredWords.filter(w => !currentAnsweredIds.includes(w.id));

        // ถ้าตอบครบทุกคำในหมวดนั้นๆ แล้ว
        if (candidateQuestions.length === 0) {
            setCurrentQuestion(null);
            if (filteredWords.length > 0) {
                setMessage('🎉 คุณฝึกคำศัพท์หมวดนี้ครบทุกคำแล้วสำหรับวันนี้! เก่งมากครับ ลองเปลี่ยนหมวดดูนะ');
            } else {
                setMessage(`หมวดหมู่นี้ยังไม่มีข้อมูล ไปเพิ่มข้อมูลก่อนนะครับ!`);
            }
            return;
        }

        if (filteredWords.length < 4) {
            setCurrentQuestion(null);
            setMessage(`หมวดหมู่นี้มีข้อมูลไม่พอสร้างช้อยส์ครับ (ต้องมีอย่างน้อย 4 คำในฐานข้อมูล)`);
            return;
        }

        const randomIndex = Math.floor(Math.random() * candidateQuestions.length);
        const questionWord = candidateQuestions[randomIndex];

        // คำหลอก (Distractors) สามารถเอาคำที่เคยตอบไปแล้วมาหลอกได้
        const distractors = filteredWords.filter((w) => w.id !== questionWord.id).sort(() => 0.5 - Math.random()).slice(0, 3);
        const allChoices = [...distractors, questionWord].sort(() => 0.5 - Math.random());

        setCurrentQuestion(questionWord);
        setChoices(allChoices);
        setMessage('');
        setIsAnswered(false); // ซ่อนปุ่ม Next เพื่อเริ่มข้อใหม่
    }

    // 🌟 ตัดระบบรอเวลาออก แล้วเปลี่ยนมาโชว์ปุ่ม Next แทน
    async function handleChoiceAnswer(selectedChoice) {
        if (isAnswered) return; // ถ้าตอบแล้วกดซ้ำไม่ได้

        const isCorrect = selectedChoice.id === currentQuestion.id;
        if (isCorrect) {
            setScore(score + 1);
            setMessage('✅ ถูกต้องครับ!');
        } else {
            setMessage(`❌ ผิดครับ! คำแปลคือ "${currentQuestion.translation}"`);
        }

        setIsAnswered(true); // โชว์ปุ่ม Next
        await supabase.from('daily_stats').insert([{ vocab_id: currentQuestion.id, is_correct: isCorrect }]);

        // บันทึก ID นี้ลงในลิสต์ว่า "ตอบไปแล้วนะ"
        const newAnsweredIds = [...answeredIdsToday, currentQuestion.id];
        setAnsweredIdsToday(newAnsweredIds);
        setPracticedToday(newAnsweredIds.length);
    }

    // 🌟 ฟังก์ชันสำหรับปุ่ม Next ของโหมดช้อยส์
    function handleNextQuestion() {
        if (quizMode === 'daily' && practicedToday >= dailyTarget) {
            setCurrentQuestion(null);
            setMessage('🎉 ยินดีด้วย! คุณฝึกคำศัพท์ครบเป้าหมาย 50% ของวันนี้แล้วครับ');
        } else {
            generateQuestion(vocabList, selectedCategory, selectedPOS, quizMode, answeredIdsToday);
        }
    }


    // ==========================================
    // โหมด Typing Practice (อัปเกรดให้กด Enter เปลี่ยนข้อได้เลย)
    // ==========================================
    function startTypingQuiz() {
        if (vocabList.length === 0) return;

        // 🌟 ในโหมด Typing ก็ไม่เอาคำที่ตอบไปแล้ววันนี้มาถามซ้ำ
        const unseenWords = vocabList.filter(w => !answeredIdsToday.includes(w.id));
        const pool = unseenWords.length > 0 ? unseenWords : vocabList; // ถ้าทำหมดแล้วจริงๆ ถึงจะยอมวนซ้ำ

        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        const selected = typingLimit === 'All' ? shuffled : shuffled.slice(0, typingLimit);

        setTypingQueue(selected);
        setTypingIndex(0);
        setTypingScore(0);
        setTypingInput('');
        setTypingFeedback(null);
        setTypingSetup(false);
    }

    async function handleTypingSubmit() {
        if (!typingInput.trim() || typingFeedback) return;

        const currentWord = typingQueue[typingIndex];
        const isCorrect = typingInput.trim().toLowerCase() === currentWord.word.toLowerCase();

        if (isCorrect) {
            setTypingScore(prev => prev + 1);
            setTypingFeedback({ status: 'correct', text: '✅ เยี่ยมมาก! พิมพ์ถูกต้องครับ' });
        } else {
            setTypingFeedback({ status: 'wrong', text: `❌ ผิดครับ! คำที่ถูกต้องคือ: ${currentWord.word}` });
        }

        await supabase.from('daily_stats').insert([{ vocab_id: currentWord.id, is_correct: isCorrect }]);
        const newAnsweredIds = [...answeredIdsToday, currentWord.id];
        setAnsweredIdsToday(newAnsweredIds);
        setPracticedToday(newAnsweredIds.length);
    }

    // 🌟 ฟังก์ชันข้ามไปข้อต่อไปสำหรับโหมด Typing
    function goToNextTypingWord() {
        setTypingInput('');
        setTypingFeedback(null);

        if (typingIndex + 1 < typingQueue.length) {
            setTypingIndex(prev => prev + 1);
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            setTypingFeedback({ status: 'end', text: `🎉 จบการทดสอบ! คุณได้คะแนน ${typingScore} / ${typingQueue.length}` });
        }
    }

    // 🌟 ดักจับปุ่ม Enter แบบฉลาดขึ้น
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (typingFeedback && typingFeedback.status !== 'end') {
                goToNextTypingWord(); // ถ้าโชว์เฉลยอยู่ กด Enter เพื่อไปข้อต่อไป
            } else if (!typingFeedback) {
                handleTypingSubmit(); // ถ้ายังไม่เฉลย กด Enter เพื่อส่งคำตอบ
            }
        }
    };

    return (
        <div style={{ minHeight: '100vh' }}>
            <div className="page-header">
                <h1>Training Room</h1>
                <button className="btn-back" onClick={() => navigate('/')}>Back</button>
            </div>

            <div style={{ maxWidth: '700px', margin: '40px auto', backgroundColor: '#fff', padding: '40px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '40px', borderBottom: '2px solid #eee', paddingBottom: '20px' }}>
                    <button onClick={() => setMainMode('choice')} style={{ flex: 1, padding: '15px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.2em', cursor: 'pointer', border: 'none', backgroundColor: mainMode === 'choice' ? '#000' : '#f0f0f0', color: mainMode === 'choice' ? '#fff' : '#666' }}>🕹️ Multiple Choice</button>
                    <button onClick={() => setMainMode('typing')} style={{ flex: 1, padding: '15px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.2em', cursor: 'pointer', border: 'none', backgroundColor: mainMode === 'typing' ? '#000' : '#f0f0f0', color: mainMode === 'typing' ? '#fff' : '#666' }}>⌨️ Typing Practice</button>
                </div>

                {/* ============================================== */}
                {/* โหมด TYPING PRACTICE */}
                {/* ============================================== */}
                {mainMode === 'typing' && (
                    <div style={{ textAlign: 'center' }}>
                        {typingSetup ? (
                            <div>
                                <h2 style={{ marginBottom: '20px' }}>ตั้งค่าการทดสอบพิมพ์</h2>
                                <div style={{ marginBottom: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                                    <label style={{ fontWeight: 'bold', fontSize: '1.2em' }}>เลือกระยะเวลา (จำนวนข้อ):</label>
                                    <select value={typingLimit} onChange={(e) => setTypingLimit(e.target.value === 'All' ? 'All' : Number(e.target.value))} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1.2em', cursor: 'pointer' }}>
                                        <option value={10}>10 คำ</option>
                                        <option value={20}>20 คำ</option>
                                        <option value={50}>50 คำ</option>
                                        <option value="All">ทั้งหมดในคลัง</option>
                                    </select>
                                </div>
                                <button onClick={startTypingQuiz} className="custom-btn" style={{ backgroundColor: '#28a745', color: '#fff', fontSize: '1.2em', padding: '15px 40px' }}>🚀 เริ่มลุยเลย!</button>
                            </div>
                        ) : (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', color: '#666', fontWeight: 'bold' }}>
                                    <span>ข้อที่ {typingFeedback?.status === 'end' ? typingQueue.length : typingIndex + 1} / {typingQueue.length}</span>
                                    <span>คะแนน: <span style={{ color: '#000', fontSize: '1.2em' }}>{typingScore}</span></span>
                                </div>

                                {typingFeedback?.status !== 'end' ? (
                                    <>
                                        <p style={{ color: '#666', fontSize: '1.2em' }}>จงพิมพ์คำแปลภาษาอังกฤษของคำว่า:</p>
                                        <h3 style={{ fontSize: '3em', color: '#333', margin: '20px 0' }}>{typingQueue[typingIndex]?.translation}</h3>

                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginTop: '30px' }}>
                                            <input
                                                ref={inputRef} type="text" autoFocus autoComplete="off" placeholder="พิมพ์ภาษาอังกฤษที่นี่ แล้วกด Enter..."
                                                value={typingInput} onChange={(e) => setTypingInput(e.target.value)} onKeyDown={handleKeyDown} disabled={!!typingFeedback}
                                                style={{ width: '100%', maxWidth: '400px', padding: '20px', fontSize: '1.5em', textAlign: 'center', borderRadius: '12px', border: '2px solid #ccc', outline: 'none' }}
                                            />

                                            {/* 🌟 ปุ่มสลับระหว่าง "ส่งคำตอบ" กับ "ข้อต่อไป" */}
                                            {!typingFeedback ? (
                                                <button onClick={handleTypingSubmit} disabled={!typingInput.trim()} className="custom-btn" style={{ width: '100%', maxWidth: '400px', backgroundColor: '#000', color: '#fff', fontSize: '1.2em' }}>
                                                    ส่งคำตอบ (Enter)
                                                </button>
                                            ) : (
                                                <button onClick={goToNextTypingWord} className="custom-btn" style={{ width: '100%', maxWidth: '400px', backgroundColor: '#0056b3', color: '#fff', fontSize: '1.2em', padding: '15px' }}>
                                                    ข้อต่อไป ➡ (Enter)
                                                </button>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <button onClick={() => setTypingSetup(true)} className="custom-btn" style={{ marginTop: '20px' }}>🔄 ลองใหม่อีกครั้ง</button>
                                )}

                                {typingFeedback && (
                                    <div style={{ marginTop: '30px', padding: '20px', borderRadius: '12px', fontSize: '1.5em', fontWeight: 'bold', backgroundColor: typingFeedback.status === 'correct' ? '#d4edda' : (typingFeedback.status === 'wrong' ? '#f8d7da' : '#fff3cd'), color: typingFeedback.status === 'correct' ? '#155724' : (typingFeedback.status === 'wrong' ? '#721c24' : '#856404') }}>
                                        {typingFeedback.text}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ============================================== */}
                {/* โหมด MULTIPLE CHOICE */}
                {/* ============================================== */}
                {mainMode === 'choice' && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
                            <button onClick={() => setQuizMode('daily')} style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', border: '2px solid #0056b3', backgroundColor: quizMode === 'daily' ? '#0056b3' : '#ffffff', color: quizMode === 'daily' ? '#ffffff' : '#0056b3' }}>🎯 Daily Goal</button>
                            <button onClick={() => setQuizMode('all')} style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', border: '2px solid #28a745', backgroundColor: quizMode === 'all' ? '#28a745' : '#ffffff', color: quizMode === 'all' ? '#ffffff' : '#28a745' }}>♾️ Practice All</button>
                            <button onClick={() => setQuizMode('today')} style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', border: '2px solid #ff8c00', backgroundColor: quizMode === 'today' ? '#ff8c00' : '#ffffff', color: quizMode === 'today' ? '#ffffff' : '#ff8c00' }}>✨ Today's New Words</button>
                        </div>

                        <div style={{ marginBottom: '20px', padding: '15px', borderRadius: '8px', fontWeight: 'bold', backgroundColor: quizMode === 'today' ? '#fff3cd' : (quizMode === 'all' ? '#d4edda' : '#f0f8ff'), color: quizMode === 'today' ? '#856404' : (quizMode === 'all' ? '#155724' : '#0056b3') }}>
                            {quizMode === 'today' && `✨ โหมดศัพท์ใหม่: ทบทวนเฉพาะคำที่คุณเพิ่งเพิ่มเข้ามาในวันนี้`}
                            {quizMode === 'all' && `♾️ โหมดฝึกซ้อมทั้งหมด: ทำไปแล้ว ${practicedToday} ข้อในวันนี้`}
                            {quizMode === 'daily' && `🎯 เป้าหมายวันนี้: ทำไปแล้ว ${practicedToday} / ${dailyTarget} ข้อ`}
                        </div>

                        <div style={{ marginBottom: '30px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '20px', backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <label style={{ fontWeight: 'bold' }}>Category:</label>
                                <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); if (e.target.value !== 'Word' && e.target.value !== 'All') setSelectedPOS('All'); }} style={{ padding: '8px 15px', borderRadius: '8px', border: '1px solid #ccc', cursor: 'pointer' }}>
                                    <option value="All">All Categories</option>
                                    {availableCategories.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <label style={{ fontWeight: 'bold', color: (selectedCategory !== 'Word' && selectedCategory !== 'All') ? '#aaa' : '#000' }}>POS:</label>
                                <select value={selectedPOS} onChange={(e) => setSelectedPOS(e.target.value)} disabled={selectedCategory !== 'Word' && selectedCategory !== 'All'} style={{ padding: '8px 15px', borderRadius: '8px', border: '1px solid #ccc', cursor: (selectedCategory !== 'Word' && selectedCategory !== 'All') ? 'not-allowed' : 'pointer', backgroundColor: (selectedCategory !== 'Word' && selectedCategory !== 'All') ? '#f0f0f0' : '#fff', color: (selectedCategory !== 'Word' && selectedCategory !== 'All') ? '#aaa' : '#000' }}>
                                    <option value="All">All Types</option>
                                    {availablePOS.map((pos, i) => <option key={i} value={pos}>{pos}</option>)}
                                </select>
                            </div>
                        </div>

                        <p style={{ fontSize: '1.2em' }}>คะแนนของคุณ: <strong style={{ fontSize: '1.5em' }}>{score}</strong></p>

                        {currentQuestion ? (
                            <div style={{ marginTop: '30px' }}>
                                <h3 style={{ fontSize: '2.5em', color: '#333' }}>
                                    {currentQuestion.word}
                                    <span style={{ fontSize: '0.4em', color: '#666', display: 'block', marginTop: '5px' }}>({currentQuestion.category} {currentQuestion.part_of_speech !== '-' && `- ${currentQuestion.part_of_speech}`})</span>
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '30px' }}>
                                    {choices.map((choice, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleChoiceAnswer(choice)}
                                            disabled={isAnswered} // 🌟 ล็อคปุ่มช้อยส์ถ้าตอบแล้ว
                                            className="custom-btn"
                                            style={{
                                                width: '100%', padding: '15px', fontSize: '1.2em', border: '1px solid #eee',
                                                cursor: isAnswered ? 'default' : 'pointer', opacity: isAnswered && choice.id !== currentQuestion.id ? 0.6 : 1
                                            }}
                                        >
                                            {choice.translation}
                                        </button>
                                    ))}
                                </div>

                                {/* 🌟 ปุ่ม Next โผล่มาเมื่อตอบคำถามแล้ว */}
                                {isAnswered && (
                                    <button onClick={handleNextQuestion} className="custom-btn" style={{ marginTop: '30px', width: '100%', backgroundColor: '#0056b3', color: '#fff', fontSize: '1.3em', padding: '15px' }}>
                                        ข้อต่อไป ➡
                                    </button>
                                )}
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
                )}

            </div>
        </div>
    );
}