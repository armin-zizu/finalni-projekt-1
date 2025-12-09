import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Clear the token cookie
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    response.cookies.delete('token');
    
    return response;
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


