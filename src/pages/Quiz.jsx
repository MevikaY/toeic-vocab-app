import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Quiz() {
    const navigate = useNavigate();
    const [vocabList, setVocabList] = useState([]);
    const [mainMode, setMainMode] = useState('choice');

    const [answeredIdsToday, setAnsweredIdsToday] = useState([]);
    const [isAnswered, setIsAnswered] = useState(false);

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

    // 🌟 ฟังก์ชันอัปเดตสถิติความจำลง Database
    async function updateWordStats(wordId, isCorrect) {
        const wordToUpdate = vocabList.find(w => w.id === wordId);
        if (!wordToUpdate) return;

        const newCorrect = (wordToUpdate.correct_count || 0) + (isCorrect ? 1 : 0);
        const newWrong = (wordToUpdate.wrong_count || 0) + (!isCorrect ? 1 : 0);

        // อัปเดตขึ้น Supabase
        await supabase.from('vocabularies').update({ correct_count: newCorrect, wrong_count: newWrong }).eq('id', wordId);

        // อัปเดตใน State ปัจจุบันด้วย
        setVocabList(prev => prev.map(w => w.id === wordId ? { ...w, correct_count: newCorrect, wrong_count: newWrong } : w));
    }

    function generateQuestion(allWords, filterCat, filterPOS, currentMode, currentAnsweredIds = []) {
        let filteredWords = allWords;

        if (currentMode === 'today') {
            const todayString = new Date().toDateString();
            filteredWords = filteredWords.filter(w => new Date(w.created_at).toDateString() === todayString);
        }
        if (filterCat !== 'All') filteredWords = filteredWords.filter(w => w.category === filterCat);
        if ((filterCat === 'All' || filterCat === 'Word') && filterPOS !== 'All') filteredWords = filteredWords.filter(w => w.part_of_speech === filterPOS);

        let candidateQuestions = filteredWords.filter(w => !currentAnsweredIds.includes(w.id));

        if (candidateQuestions.length === 0) {
            setCurrentQuestion(null);
            if (filteredWords.length > 0) setMessage('🎉 คุณฝึกคำศัพท์หมวดนี้ครบทุกคำแล้วสำหรับวันนี้!');
            else setMessage(`หมวดหมู่นี้ยังไม่มีข้อมูล ไปเพิ่มข้อมูลก่อนนะครับ!`);
            return;
        }

        if (filteredWords.length < 4) {
            setCurrentQuestion(null);
            setMessage(`หมวดหมู่นี้มีข้อมูลไม่พอสร้างช้อยส์ครับ (ต้องมีอย่างน้อย 4 คำในฐานข้อมูล)`);
            return;
        }

        const randomIndex = Math.floor(Math.random() * candidateQuestions.length);
        const questionWord = candidateQuestions[randomIndex];

        // 🌟 แก้ปัญหาที่ 1: กันไม่ให้เอาคำหลอก (Distractor) ที่มีความหมาย(คำแปล)ซ้ำกับคำตอบมาโชว์ในช้อยส์
        const distractors = filteredWords
            .filter((w) => w.id !== questionWord.id && w.translation !== questionWord.translation)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);

        const allChoices = [...distractors, questionWord].sort(() => 0.5 - Math.random());

        setCurrentQuestion(questionWord);
        setChoices(allChoices);
        setMessage('');
        setIsAnswered(false);
    }

    async function handleChoiceAnswer(selectedChoice) {
        if (isAnswered) return;

        // 🌟 แก้ปัญหาที่ 1 (ในโหมดช้อยส์): ถ้าผู้ใช้กดช้อยส์ที่เป็น Synonym ถือว่าถูกด้วย!
        const isExactMatch = selectedChoice.id === currentQuestion.id;
        const isSynonymMatch = selectedChoice.translation === currentQuestion.translation;
        const isCorrect = isExactMatch || isSynonymMatch;

        if (isCorrect) {
            setScore(score + 1);
            setMessage(isExactMatch ? '✅ ถูกต้องครับ!' : '✅ ถูกต้อง! (ความหมายเดียวกัน)');
        } else {
            setMessage(`❌ ผิดครับ! คำแปลคือ "${currentQuestion.translation}"`);
        }

        setIsAnswered(true);
        await supabase.from('daily_stats').insert([{ vocab_id: currentQuestion.id, is_correct: isCorrect }]);
        updateWordStats(currentQuestion.id, isCorrect); // 🌟 บันทึกสถิติถูก/ผิด

        const newAnsweredIds = [...answeredIdsToday, currentQuestion.id];
        setAnsweredIdsToday(newAnsweredIds);
        setPracticedToday(newAnsweredIds.length);
    }

    function handleNextQuestion() {
        if (quizMode === 'daily' && practicedToday >= dailyTarget) {
            setCurrentQuestion(null);
            setMessage('🎉 ยินดีด้วย! คุณฝึกคำศัพท์ครบเป้าหมาย 50% ของวันนี้แล้วครับ');
        } else {
            generateQuestion(vocabList, selectedCategory, selectedPOS, quizMode, answeredIdsToday);
        }
    }

    // ==========================================
    // โหมด Typing Practice 
    // ==========================================
    function startTypingQuiz() {
        if (vocabList.length === 0) return;

        let pool = vocabList;
        if (quizMode === 'today') {
            const todayString = new Date().toDateString();
            pool = vocabList.filter(w => new Date(w.created_at).toDateString() === todayString);
        } else if (quizMode === 'daily') {
            pool = vocabList.filter(w => !answeredIdsToday.includes(w.id));
            if (pool.length === 0) pool = vocabList;
        }

        // 🌟 แก้ปัญหาที่ 2: ระบบสุ่มอัจฉริยะ (Weighted Randomization)
        // คำนวณอัตราความผิดพลาด: ยิ่งตอบผิดเยอะ (ค่าเข้าใกล้ 1) ยิ่งโดนดันขึ้นไปอยู่คิวแรกๆ
        const calculateErrorRate = (word) => {
            const total = (word.correct_count || 0) + (word.wrong_count || 0);
            if (total === 0) return 0.6; // คำใหม่เอี่ยม ให้ความสำคัญปานกลางค่อนข้างสูง (0.6)
            return (word.wrong_count || 0) / total;
        };

        // จัดเรียงคำศัพท์โดยเอาคำที่ Rate ผิดพลาดสูงสุดขึ้นก่อน
        const sortedPool = [...pool].sort((a, b) => calculateErrorRate(b) - calculateErrorRate(a));

        // ตัดมาตามจำนวนที่เลือก (Limit) จากนั้นค่อยสับไพ่(Shuffle) ภายในกลุ่มนั้น เพื่อไม่ให้เรียงลำดับซ้ำซากเกินไป
        const slicedPool = typingLimit === 'All' ? sortedPool : sortedPool.slice(0, typingLimit);
        const finalQueue = slicedPool.sort(() => 0.5 - Math.random());

        setTypingQueue(finalQueue);
        setTypingIndex(0);
        setTypingScore(0);
        setTypingInput('');
        setTypingFeedback(null);
        setTypingSetup(false);
    }

    async function handleTypingSubmit() {
        if (!typingInput.trim() || typingFeedback) return;

        const typedText = typingInput.trim().toLowerCase();
        const currentWord = typingQueue[typingIndex];

        // 🌟 แก้ปัญหาที่ 1 (ในโหมดพิมพ์): เช็ค Synonym
        const isExactMatch = typedText === currentWord.word.toLowerCase();

        // ค้นหาว่าคำที่พิมพ์มา มีอยู่ในคลังศัพท์เราไหม และมีคำแปลตรงกับข้อนี้เป๊ะไหม
        const synonymWord = vocabList.find(w =>
            w.word.toLowerCase() === typedText &&
            w.translation === currentWord.translation
        );

        let isCorrect = false;

        if (isExactMatch) {
            isCorrect = true;
            setTypingScore(prev => prev + 1);
            setTypingFeedback({ status: 'correct', text: '✅ เยี่ยมมาก! พิมพ์ถูกต้องครับ' });
        } else if (synonymWord) {
            isCorrect = true;
            setTypingScore(prev => prev + 1);
            setTypingFeedback({ status: 'correct', text: `✅ ถูกต้อง! (คุณพิมพ์คำพ้องความหมาย: เราอนุโลมให้ครับ)` });
        } else {
            setTypingFeedback({ status: 'wrong', text: `❌ ผิดครับ! คำที่ถูกต้องคือ: ${currentWord.word}` });
        }

        await supabase.from('daily_stats').insert([{ vocab_id: currentWord.id, is_correct: isCorrect }]);
        updateWordStats(currentWord.id, isCorrect); // 🌟 บันทึกสถิติถูก/ผิด

        const newAnsweredIds = [...answeredIdsToday, currentWord.id];
        setAnsweredIdsToday(newAnsweredIds);
        setPracticedToday(newAnsweredIds.length);
    }

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

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (typingFeedback && typingFeedback.status !== 'end') goToNextTypingWord();
            else if (!typingFeedback) handleTypingSubmit();
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

                                {/* เพิ่มตัวเลือกโหมดเข้ามาในหน้า Typing ด้วย */}
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                    <button onClick={() => setQuizMode('daily')} style={{ padding: '8px 15px', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: quizMode === 'daily' ? '#0056b3' : '#fff', color: quizMode === 'daily' ? '#fff' : '#000' }}>เป้าหมายรายวัน</button>
                                    <button onClick={() => setQuizMode('all')} style={{ padding: '8px 15px', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: quizMode === 'all' ? '#28a745' : '#fff', color: quizMode === 'all' ? '#fff' : '#000' }}>ทั้งหมด</button>
                                    <button onClick={() => setQuizMode('today')} style={{ padding: '8px 15px', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: quizMode === 'today' ? '#ff8c00' : '#fff', color: quizMode === 'today' ? '#fff' : '#000' }}>ศัพท์วันนี้</button>
                                </div>

                                <div style={{ marginBottom: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                                    <label style={{ fontWeight: 'bold', fontSize: '1.2em' }}>จำนวนข้อ:</label>
                                    <select value={typingLimit} onChange={(e) => setTypingLimit(e.target.value === 'All' ? 'All' : Number(e.target.value))} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1.2em', cursor: 'pointer' }}>
                                        <option value={10}>10 คำ</option>
                                        <option value={20}>20 คำ</option>
                                        <option value={50}>50 คำ</option>
                                        <option value="All">ทั้งหมด</option>
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

                                        {/* 🌟 แก้ปัญหาที่ 3: โชว์ POS ในหน้า Typing ด้วย */}
                                        <h3 style={{ fontSize: '3em', color: '#333', margin: '20px 0' }}>
                                            {typingQueue[typingIndex]?.translation}
                                            <span style={{ fontSize: '0.4em', color: '#666', display: 'block', marginTop: '10px' }}>
                                                ({typingQueue[typingIndex]?.category} {typingQueue[typingIndex]?.part_of_speech !== '-' && `- ${typingQueue[typingIndex]?.part_of_speech}`})
                                            </span>
                                        </h3>

                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginTop: '30px' }}>
                                            <input
                                                ref={inputRef} type="text" autoFocus autoComplete="off" placeholder="พิมพ์ภาษาอังกฤษที่นี่..."
                                                value={typingInput} onChange={(e) => setTypingInput(e.target.value)} onKeyDown={handleKeyDown} disabled={!!typingFeedback}
                                                style={{ width: '100%', maxWidth: '400px', padding: '20px', fontSize: '1.5em', textAlign: 'center', borderRadius: '12px', border: '2px solid #ccc', outline: 'none' }}
                                            />

                                            {!typingFeedback ? (
                                                <button onClick={handleTypingSubmit} disabled={!typingInput.trim()} className="custom-btn" style={{ width: '100%', maxWidth: '400px', backgroundColor: '#000', color: '#fff', fontSize: '1.2em' }}>ส่งคำตอบ (Enter)</button>
                                            ) : (
                                                <button onClick={goToNextTypingWord} className="custom-btn" style={{ width: '100%', maxWidth: '400px', backgroundColor: '#0056b3', color: '#fff', fontSize: '1.2em', padding: '15px' }}>ข้อต่อไป ➡ (Enter)</button>
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
                {/* โหมด MULTIPLE CHOICE (คงเดิม) */}
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
                                            disabled={isAnswered}
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