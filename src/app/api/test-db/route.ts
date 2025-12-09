import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/db';

export async function GET() {
  try {
    const isConnected = await testConnection();
    
    if (isConnected) {
      return NextResponse.json({ 
        connected: true, 
        message: 'Database connection successful' 
      });
    } else {
      return NextResponse.json({ 
        connected: false, 
        message: 'Database connection failed' 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Test DB error:', error);
    return NextResponse.json({ 
      connected: false, 
      error: error.message 
    }, { status: 500 });
  }
}


