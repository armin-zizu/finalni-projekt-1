import { NextRequest } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

// SSE endpoint za real-time updates
async function sseHandler(req: AuthRequest): Promise<Response> {
  try {
    if (!req.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Kreiraj ReadableStream za SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Pošalji početnu poruku
        controller.enqueue(encoder.encode(': connected\n\n'));

        // Funkcija za slanje poruke
        const sendMessage = (data: any) => {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        // Provjeri da li je admin
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'gitara.zizu@gmail.com';
        let userEmail = req.user!.userId;
        let resolvedUserId = req.user!.userId;

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        
        if (uuidRegex.test(req.user!.userId)) {
          const userResult = await query(
            'SELECT email, id FROM users WHERE id = $1 LIMIT 1',
            [req.user!.userId]
          );
          
          if (userResult.rows.length > 0) {
            userEmail = userResult.rows[0].email;
            resolvedUserId = userResult.rows[0].id;
          }
        } else {
          const userResult = await query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [req.user!.userId]
          );
          
          if (userResult.rows.length > 0) {
            resolvedUserId = userResult.rows[0].id;
          }
        }

        const isAdmin = userEmail?.toLowerCase().trim() === adminEmail.toLowerCase().trim();

        // Polling funkcija
        let lastCheckTime = new Date();

        const pollInterval = setInterval(async () => {
          try {
            let newMessages = [];

            if (isAdmin) {
              // Admin vidi nove poruke od korisnika
              const result = await query(
                `SELECT id, user_id, message, created_at, is_read, is_admin_response, conversation_id
                 FROM support_messages
                 WHERE created_at > $1 AND is_admin_response = FALSE
                 ORDER BY created_at DESC`,
                [lastCheckTime]
              );
              newMessages = result.rows;
            } else {
              // Korisnik vidi nove admin odgovore
              const result = await query(
                `SELECT id, user_id, message, created_at, is_read, is_admin_response, conversation_id
                 FROM support_messages
                 WHERE user_id = $1 AND created_at > $2 AND is_admin_response = TRUE
                 ORDER BY created_at DESC`,
                [resolvedUserId, lastCheckTime]
              );
              newMessages = result.rows;
            }

            if (newMessages.length > 0) {
              sendMessage({
                type: 'new_messages',
                messages: newMessages.map(row => ({
                  id: row.id,
                  userId: row.user_id,
                  message: row.message,
                  createdAt: row.created_at,
                  isRead: row.is_read,
                  isAdminResponse: row.is_admin_response,
                  conversationId: row.conversation_id,
                })),
              });
              lastCheckTime = new Date();
            }

            // Ping da održimo konekciju živom
            sendMessage({ type: 'ping' });
          } catch (error) {
            console.error('SSE polling error:', error);
            sendMessage({ type: 'error', message: 'Polling error' });
          }
        }, 3000); // Poll svake 3 sekunde

        // Cleanup na disconnect
        req.signal.addEventListener('abort', () => {
          clearInterval(pollInterval);
          controller.close();
        });

        // Heartbeat svakih 30 sekundi
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          } catch (error) {
            clearInterval(heartbeatInterval);
            clearInterval(pollInterval);
            controller.close();
          }
        }, 30000);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable buffering for nginx
      },
    });
  } catch (error: any) {
    console.error('SSE handler error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return withAuth(sseHandler)(req);
}

