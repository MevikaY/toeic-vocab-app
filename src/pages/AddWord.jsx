import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function AddWord() {
    const navigate = useNavigate();
    const [word, setWord] = useState('');
    const [translation, setTranslation] = useState('');
    const [partOfSpeech, setPartOfSpeech] = useState('');

    // 🌟 State ใหม่สำหรับหมวดหมู่ (Category)
    const [category, setCategory] = useState('Word');
    const [vocabList, setVocabList] = useState([]);

    useEffect(() => {
        fetchVocab();
    }, []);

    async function fetchVocab() {
        const { data, error } = await supabase
            .from('vocabularies')
            .select('*')
            .order('id', { ascending: false });

        if (!error) {
            setVocabList(data);
        }
    }

    const isDuplicate = vocabList.some(
        (item) => item.word.toLowerCase() === word.toLowerCase().trim()
    );

    async function handleSubmit(e) {
        if (e) e.preventDefault();

        // 🌟 ปรับเงื่อนไข: ถ้าเป็น Word ต้องกรอก POS ด้วย แต่ถ้าเป็นหมวดอื่น ไม่ต้องกรอกก็ได้
        const isPosRequired = category === 'Word' ? !partOfSpeech : false;

        if (!word || !translation || isDuplicate || isPosRequired) return;

        const { error } = await supabase
            .from('vocabularies')
            .insert([
                {
                    word: word.trim(),
                    translation: translation.trim(),
                    part_of_speech: partOfSpeech.trim() || '-', // ถ้าเว้นว่างไว้ ให้ใส่ขีด (-) แทน
                    category: category // 🌟 ส่งค่าหมวดหมู่ไปด้วย
                }
            ]);

        if (!error) {
            alert('เพิ่มข้อมูลสำเร็จ!');
            setWord('');
            setTranslation('');
            setPartOfSpeech('');
            setCategory('Word'); // กลับไปค่าเริ่มต้น
            fetchVocab();
        } else {
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
            console.error(error);
        }
    }

    // 🌟 ตัวช่วยเช็คว่าปุ่ม Submit ควรจะถูกล็อคไหม
    const isSubmitDisabled = isDuplicate || !word || !translation || (category === 'Word' && !partOfSpeech);

    return (
        <div style={{ minHeight: '100vh' }}>
            <div className="page-header">
                <h1>Vocabulary & Idiom Management</h1>
                <button className="btn-back" onClick={() => navigate('/')}>Back</button>
            </div>

            <div style={{ padding: '60px', display: 'flex', gap: '50px', justifyContent: 'center', flexWrap: 'wrap' }}>

                {/* ฝั่งซ้าย: ฟอร์มเพิ่มข้อมูล */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '350px' }}>

                    {/* 🌟 Dropdown เลือก Category */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <label style={{ width: '120px', fontWeight: 'bold' }}>Category</label>
                        <select
                            className="custom-input"
                            value={category}
                            onChange={(e) => {
                                setCategory(e.target.value);
                                if (e.target.value !== 'Word') setPartOfSpeech(''); // ล้างค่า POS อัตโนมัติถ้าไม่ใช่ Word
                            }}
                            style={{ padding: '10px 15px', width: '100%', maxWidth: '300px', cursor: 'pointer' }}
                        >
                            <option value="Word">Word (คำศัพท์เดี่ยว)</option>
                            <option value="Collocation">Collocation (กลุ่มคำ)</option>
                            <option value="Idiom">Idiom (สำนวน)</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
                        <label style={{ width: '120px', fontWeight: 'bold', marginTop: '15px' }}>Text</label>
                        <div style={{ width: '100%', maxWidth: '300px' }}>
                            <input
                                type="text"
                                className="custom-input"
                                placeholder="Input Word or Idiom"
                                value={word}
                                onChange={(e) => setWord(e.target.value)}
                            />
                            {isDuplicate && (
                                <p style={{ color: '#dc3545', fontSize: '13px', marginTop: '8px', fontWeight: 'bold' }}>
                                    ⚠️ ข้อมูลนี้มีในฐานข้อมูลแล้ว
                                </p>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <label style={{ width: '120px', fontWeight: 'bold' }}>Translation</label>
                        <input
                            type="text"
                            className="custom-input"
                            placeholder="Input Translation"
                            value={translation}
                            onChange={(e) => setTranslation(e.target.value)}
                        />
                    </div>

                    {/* 🌟 ช่อง POS จะแสดงเครื่องหมายดอกจัน (*) แค่ตอนที่เลือกเป็น Word */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <label style={{ width: '120px', fontWeight: 'bold' }}>
                            Part Of Speech {category === 'Word' && <span style={{ color: 'red' }}>*</span>}
                        </label>
                        <input
                            type="text"
                            className="custom-input"
                            placeholder={category === 'Word' ? "e.g. n., v., adj." : "Optional (ไม่บังคับ)"}
                            value={partOfSpeech}
                            onChange={(e) => setPartOfSpeech(e.target.value)}
                            disabled={category !== 'Word'} // ถ้าไม่ใช่ Word ให้กรอกไม่ได้
                            style={{ backgroundColor: category !== 'Word' ? '#f0f0f0' : '#fff' }}
                        />
                    </div>

                    <div style={{ paddingLeft: '140px', marginTop: '10px' }}>
                        <button
                            className="custom-btn"
                            onClick={handleSubmit}
                            disabled={isSubmitDisabled}
                            style={{
                                backgroundColor: isSubmitDisabled ? '#e0e0e0' : '#000000',
                                color: isSubmitDisabled ? '#999' : '#ffffff',
                                cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            Submit
                        </button>
                    </div>
                </div>

                {/* ฝั่งขวา: ตารางแสดงข้อมูลที่ปรับปรุงใหม่ */}
                <div style={{
                    flex: 1,
                    minWidth: '500px',
                    backgroundColor: '#ffffff',
                    padding: '25px',
                    borderRadius: '16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                }}>
                    <h3 style={{ marginBottom: '20px' }}>Database Storage</h3>

                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9f9f9', zIndex: 1 }}>
                                <tr style={{ borderBottom: '2px solid #eee' }}>
                                    <th style={{ padding: '12px' }}>Text</th>
                                    <th style={{ padding: '12px' }}>Category</th>
                                    <th style={{ padding: '12px' }}>POS</th>
                                    <th style={{ padding: '12px' }}>Translation</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vocabList.map((item) => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{item.word}</td>
                                        <td style={{ padding: '12px' }}>
                                            {/* 🌟 ตกแต่งป้ายกำกับหมวดหมู่ให้สีต่างกัน */}
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                backgroundColor: item.category === 'Idiom' ? '#ffeeba' : item.category === 'Collocation' ? '#b8daff' : '#d4edda',
                                                color: item.category === 'Idiom' ? '#856404' : item.category === 'Collocation' ? '#004085' : '#155724'
                                            }}>
                                                {item.category || 'Word'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', color: '#666' }}>{item.part_of_speech}</td>
                                        <td style={{ padding: '12px' }}>{item.translation}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                </div>

            </div>
        </div>
    );
}