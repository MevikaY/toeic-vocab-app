import { createClient } from '@supabase/supabase-js'

// ดึงค่า URL และ Key จากไฟล์ .env.local มาใช้งาน
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// สร้างตัวเชื่อมต่อ (Client) และส่งออกไปให้ไฟล์อื่นๆ ในโปรเจกต์ใช้งานได้
export const supabase = createClient(supabaseUrl, supabaseAnonKey)