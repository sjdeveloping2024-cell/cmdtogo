"""
Pick-A-Book  |  Flask + Flask-SocketIO backend
Socket events emitted on every borrow / return / add / delete action.
Both the HTML dashboard and the Expo mobile app receive live updates.
"""

import re
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from flask_socketio import SocketIO, emit
import mysql.connector
from mysql.connector import Error as MySQLError
from datetime import datetime, timedelta
from functools import wraps
import serial, serial.tools.list_ports, threading, time
from config import DB_CONFIG

app = Flask(__name__)
app.secret_key = 'pick-a-book-secret-2024'

# ── Socket.IO — polling only (no WebSocket upgrade, works on Python 3.14) ──
socketio = SocketIO(app, cors_allowed_origins='*', async_mode='threading', allow_upgrades=False)

# ── Student ID format: 00-0000-000000 ────────────────────────
SID_PATTERN = re.compile(r'^\d{2}-\d{4}-\d{6}$')


# ══════════════════════════════════════════════════════════════
# ARDUINO
# ══════════════════════════════════════════════════════════════

arduino      = None
_serial_lock = threading.Lock()

def find_arduino_port():
    for p in serial.tools.list_ports.comports():
        desc = (p.description or '').lower()
        if any(k in desc for k in ('arduino','ch340','ch341','cp210','ftdi','usb serial')):
            return p.device
    ports = serial.tools.list_ports.comports()
    return ports[0].device if ports else None

def init_arduino():
    global arduino
    port = find_arduino_port()
    if not port:
        print('[Arduino] No port found — LCD disabled.')
        return
    try:
        arduino = serial.Serial(port, 9600, timeout=2)
        time.sleep(2)
        print(f'[Arduino] Connected on {port}')
        lcd_send('Pick-A-Book', 'System Ready')
    except Exception as e:
        print(f'[Arduino] Error: {e}')

def lcd_send(line1: str, line2: str = ''):
    if arduino is None or not arduino.is_open:
        return
    with _serial_lock:
        try:
            arduino.write(f'{line1[:16]}|{line2[:16]}\n'.encode())
        except Exception as e:
            print(f'[Arduino] Write error: {e}')


# ══════════════════════════════════════════════════════════════
# DATABASE HELPERS
# ══════════════════════════════════════════════════════════════

def get_db():
    conn   = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)
    return conn, cursor

def close_db(conn, cursor):
    if cursor: cursor.close()
    if conn and conn.is_connected(): conn.close()


# ══════════════════════════════════════════════════════════════
# SOCKET.IO — REAL-TIME HELPERS
# ══════════════════════════════════════════════════════════════

def get_stats():
    conn, cursor = get_db()
    try:
        cursor.execute('SELECT COALESCE(SUM(quantity),0) v FROM books')
        tb = int(cursor.fetchone()['v'])
        cursor.execute('SELECT COUNT(*) v FROM students')
        ts = int(cursor.fetchone()['v'])
        cursor.execute("SELECT COUNT(*) v FROM borrows WHERE status='borrowed'")
        bb = int(cursor.fetchone()['v'])
        cursor.execute('SELECT COALESCE(SUM(available),0) v FROM books')
        ab = int(cursor.fetchone()['v'])
        return {'total_books': tb, 'total_students': ts,
                'borrowed_books': bb, 'available_books': ab}
    finally:
        close_db(conn, cursor)

def get_active_borrows():
    conn, cursor = get_db()
    try:
        cursor.execute('''
            SELECT b.id,
                   s.student_id AS student_code, s.full_name AS student_name,
                   bk.title AS book_title, b.borrow_date, b.due_date
            FROM borrows b
            JOIN students s ON b.student_id = s.id
            JOIN books bk   ON b.book_id    = bk.id
            WHERE b.status = 'borrowed'
            ORDER BY b.borrow_date DESC
        ''')
        rows = cursor.fetchall()
        for r in rows:
            for k in ('borrow_date','due_date'):
                if r.get(k) and not isinstance(r[k], str):
                    r[k] = r[k].strftime('%Y-%m-%d')
        return rows
    finally:
        close_db(conn, cursor)

def broadcast():
    data = get_stats()
    data['borrows'] = get_active_borrows()
    socketio.emit('dashboard_update', data)

def broadcast_to_student(student_db_id: int):
    conn, cursor = get_db()
    try:
        cursor.execute('''
            SELECT b.id, bk.title AS book_title, bk.author,
                   b.borrow_date, b.due_date,
                   DATEDIFF(b.due_date, CURDATE()) AS days_remaining,
                   TIMESTAMPDIFF(SECOND, NOW(),
                       TIMESTAMP(b.due_date,'23:59:59')) AS seconds_remaining
            FROM borrows b
            JOIN books bk ON b.book_id = bk.id
            WHERE b.student_id = %s AND b.status = 'borrowed'
            ORDER BY b.due_date ASC
        ''', (student_db_id,))
        rows = cursor.fetchall()
        for r in rows:
            for k in ('borrow_date','due_date'):
                if r.get(k) and not isinstance(r[k], str):
                    r[k] = r[k].strftime('%Y-%m-%d')
            r['seconds_remaining'] = int(r['seconds_remaining'] or 0)
            r['days_remaining']    = int(r['days_remaining']    or 0)
        socketio.emit('student_borrows_update',
                      {'borrows': rows},
                      room=f'student_{student_db_id}')
    finally:
        close_db(conn, cursor)


# ══════════════════════════════════════════════════════════════
# SOCKET.IO EVENT HANDLERS
# ══════════════════════════════════════════════════════════════

@socketio.on('connect')
def on_connect():
    data = get_stats()
    data['borrows'] = get_active_borrows()
    emit('dashboard_update', data)

@socketio.on('request_update')
def on_request_update():
    data = get_stats()
    data['borrows'] = get_active_borrows()
    emit('dashboard_update', data)

@socketio.on('join_student_room')
def on_join_student(data):
    from flask_socketio import join_room
    student_id = data.get('student_id')
    if student_id:
        join_room(f'student_{student_id}')
        emit('joined', {'room': f'student_{student_id}'})


# ══════════════════════════════════════════════════════════════
# AUTH DECORATORS
# ══════════════════════════════════════════════════════════════

def login_required(f):
    @wraps(f)
    def d(*a, **kw):
        if 'user_id' not in session:
            return redirect(url_for('login_page'))
        return f(*a, **kw)
    return d

def student_login_required(f):
    @wraps(f)
    def d(*a, **kw):
        if 'student_db_id' not in session:
            return redirect(url_for('student_login_page'))
        return f(*a, **kw)
    return d


# ══════════════════════════════════════════════════════════════
# LIBRARIAN WEB APP
# ══════════════════════════════════════════════════════════════

@app.route('/')
def landing_page():
    if 'user_id' in session: return redirect(url_for('dashboard'))
    return render_template('librarian/landing.html')

@app.route('/login')
def login_page():
    if 'user_id' in session: return redirect(url_for('dashboard'))
    return render_template('librarian/LogIn.html')

@app.route('/login', methods=['POST'])
def login_process():
    email = request.form.get('email','').strip()
    pw    = request.form.get('password','').strip()
    if not email or not pw:
        flash('Both fields are required.'); return redirect(url_for('login_page'))
    if '@' not in email:
        flash('Invalid email.'); return redirect(url_for('login_page'))
    conn, cursor = get_db()
    try:
        cursor.execute('SELECT * FROM librarians WHERE email=%s', (email,))
        user = cursor.fetchone()
        if not user:
            flash('No account found. Please register first.')
            lcd_send('Login Failed','Not registered')
            return redirect(url_for('login_page'))
        if user['password'] != pw:
            flash('Incorrect password.')
            lcd_send('Login Failed','Wrong password')
            return redirect(url_for('login_page'))
        session['user_id']   = user['id']
        session['user_name'] = user['full_name']
        session['role']      = user['role']
        lcd_send('Login OK', user['full_name'][:16])
        return redirect(url_for('dashboard'))
    finally:
        close_db(conn, cursor)

@app.route('/register')
def registration_page():
    if 'user_id' in session: return redirect(url_for('dashboard'))
    return render_template('librarian/Register.html')

@app.route('/register', methods=['POST'])
def register_process():
    name  = request.form.get('name','').strip()
    email = request.form.get('email','').strip()
    pw    = request.form.get('password','').strip()
    if not name or not email or not pw:
        flash('All fields are required.'); return redirect(url_for('registration_page'))
    if len(pw) < 6:
        flash('Password must be 6+ characters.'); return redirect(url_for('registration_page'))
    conn, cursor = get_db()
    try:
        cursor.execute('SELECT id FROM librarians WHERE email=%s',(email,))
        if cursor.fetchone():
            flash('Email already registered.'); return redirect(url_for('registration_page'))
        cursor.execute('INSERT INTO librarians (full_name,email,password) VALUES (%s,%s,%s)',
                       (name,email,pw))
        conn.commit()
        lcd_send('Registered!', name[:16])
        flash('Account created! Please log in.')
        return redirect(url_for('login_page'))
    except MySQLError as e:
        flash(f'DB error: {e.msg}'); return redirect(url_for('registration_page'))
    finally:
        close_db(conn, cursor)

@app.route('/logout')
def logout():
    session.clear(); return redirect(url_for('login_page'))

@app.route('/dashboard')
@login_required
def dashboard():
    stats   = get_stats()
    borrows = get_active_borrows()
    return render_template('librarian/index.html',
        total_books=stats['total_books'], total_students=stats['total_students'],
        borrowed_books=stats['borrowed_books'], available_books=stats['available_books'],
        recent_borrowed=borrows)

@app.route('/borrow', methods=['POST'])
@login_required
def borrow_book():
    student_code = request.form['student_id']
    book_id      = request.form['book_id']
    conn, cursor = get_db()
    try:
        cursor.execute('SELECT * FROM students WHERE student_id=%s', (student_code,))
        student = cursor.fetchone()
        if not student:
            flash('Student not found.'); lcd_send('Borrow Error','Student N/A')
            return redirect(url_for('dashboard'))
        cursor.execute('SELECT * FROM books WHERE id=%s AND available>0', (book_id,))
        book = cursor.fetchone()
        if not book:
            flash('Book not available.'); lcd_send('Borrow Error','Book N/A')
            return redirect(url_for('dashboard'))
        today    = datetime.now().strftime('%Y-%m-%d')
        due_date = (datetime.now()+timedelta(days=14)).strftime('%Y-%m-%d')
        cursor.execute('INSERT INTO borrows (student_id,book_id,borrow_date,due_date) VALUES (%s,%s,%s,%s)',
                       (student['id'], book_id, today, due_date))
        cursor.execute('UPDATE books SET available=available-1 WHERE id=%s', (book_id,))
        conn.commit()
        flash('Book borrowed successfully!')
        lcd_send('Borrowed:', f"{student['full_name'].split()[0]}-{book['title']}"[:16])
        broadcast()
        socketio.emit('borrow_event', {
            'student_name': student['full_name'],
            'book_title':   book['title'],
            'due_date':     due_date,
        })
        broadcast_to_student(student['id'])
        return redirect(url_for('dashboard'))
    finally:
        close_db(conn, cursor)

@app.route('/return', methods=['POST'])
@login_required
def return_book():
    borrow_id = request.form['borrow_id']
    conn, cursor = get_db()
    try:
        cursor.execute('SELECT * FROM borrows WHERE id=%s', (borrow_id,))
        borrow = cursor.fetchone()
        if borrow and borrow['status'] == 'borrowed':
            today = datetime.now().strftime('%Y-%m-%d')
            cursor.execute("UPDATE borrows SET status='returned',return_date=%s WHERE id=%s",
                           (today, borrow_id))
            cursor.execute('UPDATE books SET available=available+1 WHERE id=%s', (borrow['book_id'],))
            conn.commit()
            cursor.execute('SELECT title FROM books WHERE id=%s', (borrow['book_id'],))
            bk = cursor.fetchone()
            flash('Book returned successfully!')
            lcd_send('Returned OK!', (bk['title'] if bk else 'Book')[:16])
            broadcast()
            socketio.emit('return_event', {
                'borrow_id':  borrow_id,
                'book_title': bk['title'] if bk else '',
            })
            broadcast_to_student(borrow['student_id'])
        else:
            flash('Invalid return request.')
        return redirect(url_for('dashboard'))
    finally:
        close_db(conn, cursor)

@app.route('/search_student', methods=['POST'])
@login_required
def search_student():
    name = (request.get_json() or {}).get('name','')
    conn, cursor = get_db()
    try:
        cursor.execute('''
            SELECT s.student_id, s.full_name, bk.title AS book_title,
                   b.due_date, b.id AS borrow_id
            FROM borrows b
            JOIN students s ON b.student_id=s.id
            JOIN books bk   ON b.book_id=bk.id
            WHERE s.full_name LIKE %s AND b.status='borrowed'
        ''', (f'%{name}%',))
        rows = cursor.fetchall()
        for r in rows:
            if r.get('due_date') and not isinstance(r['due_date'], str):
                r['due_date'] = r['due_date'].strftime('%Y-%m-%d')
        return jsonify({'students': rows})
    finally:
        close_db(conn, cursor)

@app.route('/books')
@login_required
def books_page():
    conn, cursor = get_db()
    try:
        cursor.execute("SELECT *,CASE WHEN available>0 THEN 'Available' ELSE 'Unavailable' END AS status FROM books ORDER BY id DESC")
        return render_template('librarian/books.html', books=cursor.fetchall())
    finally:
        close_db(conn, cursor)

@app.route('/add_book', methods=['POST'])
@login_required
def add_book():
    title    = request.form['title']
    author   = request.form['author']
    isbn     = request.form.get('isbn','')
    category = request.form.get('category','')
    quantity = int(request.form.get('quantity',1))
    conn, cursor = get_db()
    try:
        cursor.execute('INSERT INTO books (title,author,isbn,category,quantity,available) VALUES (%s,%s,%s,%s,%s,%s)',
                       (title,author,isbn,category,quantity,quantity))
        conn.commit()
        flash('Book added!')
        broadcast()
        socketio.emit('book_added', {'title': title, 'author': author})
        return redirect(url_for('books_page'))
    finally:
        close_db(conn, cursor)

@app.route('/delete_book', methods=['POST'])
@login_required
def delete_book():
    book_id = request.form['book_id']
    conn, cursor = get_db()
    try:
        cursor.execute("UPDATE borrows SET status='returned' WHERE book_id=%s AND status='borrowed'", (book_id,))
        cursor.execute('DELETE FROM books WHERE id=%s', (book_id,))
        conn.commit()
        flash('Book deleted.')
        broadcast()
        socketio.emit('book_deleted', {'book_id': book_id})
        return redirect(url_for('books_page'))
    finally:
        close_db(conn, cursor)

@app.route('/students')
@login_required
def students_page():
    q = request.args.get('search','')
    conn, cursor = get_db()
    try:
        if q:
            cursor.execute('SELECT * FROM students WHERE full_name LIKE %s OR student_id LIKE %s OR email LIKE %s ORDER BY id DESC',
                           (f'%{q}%',f'%{q}%',f'%{q}%'))
        else:
            cursor.execute('SELECT * FROM students ORDER BY id DESC')
        return render_template('librarian/Student.html', students=cursor.fetchall(), search_query=q)
    finally:
        close_db(conn, cursor)

@app.route('/add_student', methods=['POST'])
@login_required
def add_student():
    full_name  = request.form.get('full_name','').strip()
    student_id = request.form.get('student_id','').strip()
    email      = request.form.get('email','').strip()
    course     = request.form.get('course','').strip()
    year_level = request.form.get('year_level') or None

    if not full_name or not student_id:
        flash('Full name and Student ID are required.')
        return redirect(url_for('students_page'))
    if not SID_PATTERN.match(student_id):
        flash('Student ID must be in format 00-0000-000000 (e.g. 24-0001-000001)')
        return redirect(url_for('students_page'))

    conn, cursor = get_db()
    try:
        cursor.execute('INSERT INTO students (full_name,student_id,email,course,year_level) VALUES (%s,%s,%s,%s,%s)',
                       (full_name, student_id, email, course, year_level))
        conn.commit()
        flash('Student added!')
        broadcast()
        socketio.emit('student_added', {'name': full_name})
    except MySQLError as e:
        flash('Student ID already exists.' if e.errno==1062 else f'Error: {e.msg}')
    finally:
        close_db(conn, cursor)
    return redirect(url_for('students_page'))

@app.route('/delete_student', methods=['POST'])
@login_required
def delete_student():
    sid = request.form['student_id']
    conn, cursor = get_db()
    try:
        cursor.execute('DELETE FROM borrows  WHERE student_id=%s', (sid,))
        cursor.execute('DELETE FROM students WHERE id=%s',         (sid,))
        conn.commit()
        flash('Student deleted.')
        broadcast()
        socketio.emit('student_deleted', {'student_db_id': sid})
    finally:
        close_db(conn, cursor)
    return redirect(url_for('students_page'))

@app.route('/profile')
@login_required
def profile_page():
    conn, cursor = get_db()
    try:
        cursor.execute('SELECT * FROM librarians WHERE id=%s', (session['user_id'],))
        user = cursor.fetchone()
        cursor.execute('''
            SELECT s.full_name AS student_name, bk.title, b.borrow_date, b.status
            FROM borrows b
            JOIN students s ON b.student_id=s.id
            JOIN books bk   ON b.book_id=bk.id
            ORDER BY b.borrow_date DESC LIMIT 10
        ''')
        borrowed = cursor.fetchall()
        for r in borrowed:
            if r.get('borrow_date') and not isinstance(r['borrow_date'], str):
                r['borrow_date'] = r['borrow_date'].strftime('%Y-%m-%d')
        return render_template('librarian/Profile.html', user=user, borrowed=borrowed)
    finally:
        close_db(conn, cursor)

@app.route('/about')
@login_required
def about_page():
    return render_template('librarian/about.html')


# ══════════════════════════════════════════════════════════════
# STUDENT WEB APP
# ══════════════════════════════════════════════════════════════

@app.route('/student')
def student_login_page():
    if 'student_db_id' in session: return redirect(url_for('student_dashboard'))
    return render_template('student/login.html')

@app.route('/student/login', methods=['POST'])
def student_login_process():
    sid = request.form.get('student_id','').strip()
    if not sid:
        flash('Please enter your Student ID.')
        return redirect(url_for('student_login_page'))
    conn, cursor = get_db()
    try:
        cursor.execute('SELECT * FROM students WHERE student_id=%s', (sid,))
        student = cursor.fetchone()
        if not student:
            flash('Student ID not found. Contact your librarian.')
            lcd_send('Student Login','ID Not Found')
            return redirect(url_for('student_login_page'))
        session['student_db_id'] = student['id']
        session['student_sid']   = student['student_id']
        session['student_name']  = student['full_name']
        lcd_send('Welcome!', student['full_name'][:16])
        return redirect(url_for('student_dashboard'))
    finally:
        close_db(conn, cursor)

@app.route('/student/logout')
def student_logout():
    session.pop('student_db_id', None)
    session.pop('student_sid',   None)
    session.pop('student_name',  None)
    return redirect(url_for('student_login_page'))

@app.route('/student/dashboard')
@student_login_required
def student_dashboard():
    conn, cursor = get_db()
    try:
        cursor.execute('SELECT * FROM students WHERE id=%s', (session['student_db_id'],))
        student = cursor.fetchone()
        cursor.execute('''
            SELECT b.id, bk.title AS book_title, bk.author,
                   b.borrow_date, b.due_date,
                   DATEDIFF(b.due_date, CURDATE()) AS days_remaining
            FROM borrows b JOIN books bk ON b.book_id=bk.id
            WHERE b.student_id=%s AND b.status='borrowed'
            ORDER BY b.due_date ASC
        ''', (session['student_db_id'],))
        borrows = cursor.fetchall()
        for r in borrows:
            for k in ('borrow_date','due_date'):
                if r.get(k) and not isinstance(r[k], str):
                    r[k] = r[k].strftime('%Y-%m-%d')
        return render_template('student/dashboard.html', student=student, borrows=borrows)
    finally:
        close_db(conn, cursor)

@app.route('/student/settings', methods=['POST'])
@student_login_required
def student_settings():
    full_name  = request.form.get('full_name','').strip()
    student_id = request.form.get('student_id','').strip()
    email      = request.form.get('email','').strip()
    course     = request.form.get('course','').strip()
    year_level = request.form.get('year_level') or None
    if not full_name or not student_id:
        flash('Full name and Student ID are required.')
        return redirect(url_for('student_dashboard'))
    if not SID_PATTERN.match(student_id):
        flash('Student ID must be in format 00-0000-000000')
        return redirect(url_for('student_dashboard'))
    conn, cursor = get_db()
    try:
        cursor.execute('SELECT id FROM students WHERE student_id=%s AND id!=%s',
                       (student_id, session['student_db_id']))
        if cursor.fetchone():
            flash('That Student ID is already taken.')
            return redirect(url_for('student_dashboard'))
        cursor.execute('UPDATE students SET full_name=%s,student_id=%s,email=%s,course=%s,year_level=%s WHERE id=%s',
                       (full_name,student_id,email,course,year_level,session['student_db_id']))
        conn.commit()
        session['student_name'] = full_name
        session['student_sid']  = student_id
        flash('Profile updated!')
    except MySQLError as e:
        flash(f'Update failed: {e.msg}')
    finally:
        close_db(conn, cursor)
    return redirect(url_for('student_dashboard'))


# ══════════════════════════════════════════════════════════════
# MOBILE API  (Expo Go)
# ══════════════════════════════════════════════════════════════

@app.route('/api/student/login', methods=['POST'])
def api_student_login():
    data = request.get_json(force=True) or {}
    sid  = (data.get('student_id') or '').strip()
    if not sid:
        return jsonify({'ok': False, 'error': 'Student ID is required.'}), 400
    conn, cursor = get_db()
    try:
        cursor.execute('SELECT * FROM students WHERE student_id=%s', (sid,))
        s = cursor.fetchone()
        if not s:
            return jsonify({'ok': False, 'error': 'Student ID not found. Contact your librarian.'}), 404
        lcd_send('Welcome!', s['full_name'][:16])
        return jsonify({'ok': True, 'student': {
            'id': s['id'], 'student_id': s['student_id'],
            'full_name': s['full_name'], 'email': s['email'] or '',
            'course': s['course'] or '', 'year_level': s['year_level'] or '',
        }})
    finally:
        close_db(conn, cursor)

@app.route('/api/student/borrows/<int:sid>', methods=['GET'])
def api_student_borrows(sid):
    conn, cursor = get_db()
    try:
        cursor.execute('''
            SELECT b.id, bk.title AS book_title, bk.author,
                   b.borrow_date, b.due_date,
                   DATEDIFF(b.due_date, CURDATE()) AS days_remaining,
                   TIMESTAMPDIFF(SECOND,NOW(),TIMESTAMP(b.due_date,'23:59:59')) AS seconds_remaining
            FROM borrows b JOIN books bk ON b.book_id=bk.id
            WHERE b.student_id=%s AND b.status='borrowed'
            ORDER BY b.due_date ASC
        ''', (sid,))
        rows = cursor.fetchall()
        for r in rows:
            for k in ('borrow_date','due_date'):
                if r.get(k) and not isinstance(r[k], str):
                    r[k] = r[k].strftime('%Y-%m-%d')
            r['seconds_remaining'] = int(r['seconds_remaining'] or 0)
            r['days_remaining']    = int(r['days_remaining']    or 0)
        return jsonify({'ok': True, 'borrows': rows})
    finally:
        close_db(conn, cursor)

@app.route('/api/student/history/<int:sid>', methods=['GET'])
def api_student_history(sid):
    conn, cursor = get_db()
    try:
        cursor.execute('''
            SELECT b.id, bk.title AS book_title, bk.author,
                   b.borrow_date, b.due_date, b.return_date, b.status
            FROM borrows b JOIN books bk ON b.book_id=bk.id
            WHERE b.student_id=%s AND b.status='returned'
            ORDER BY b.return_date DESC
        ''', (sid,))
        rows = cursor.fetchall()
        for r in rows:
            for k in ('borrow_date','due_date','return_date'):
                if r.get(k) and not isinstance(r[k], str):
                    r[k] = r[k].strftime('%Y-%m-%d')
        return jsonify({'ok': True, 'history': rows})
    finally:
        close_db(conn, cursor)

@app.route('/api/student/update/<int:sid>', methods=['PUT'])
def api_student_update(sid):
    data       = request.get_json(force=True) or {}
    full_name  = (data.get('full_name')  or '').strip()
    student_id = (data.get('student_id') or '').strip()
    email      = (data.get('email')      or '').strip()
    course     = (data.get('course')     or '').strip()
    year_level = data.get('year_level')

    if not full_name or not student_id:
        return jsonify({'ok': False, 'error': 'Full name and Student ID required.'}), 400
    if not SID_PATTERN.match(student_id):
        return jsonify({'ok': False, 'error': 'Student ID must be in format 00-0000-000000'}), 400

    conn, cursor = get_db()
    try:
        cursor.execute('SELECT id FROM students WHERE student_id=%s AND id!=%s', (student_id, sid))
        if cursor.fetchone():
            return jsonify({'ok': False, 'error': 'Student ID already taken.'}), 409
        cursor.execute('UPDATE students SET full_name=%s,student_id=%s,email=%s,course=%s,year_level=%s WHERE id=%s',
                       (full_name,student_id,email,course,year_level or None,sid))
        conn.commit()
        cursor.execute('SELECT * FROM students WHERE id=%s', (sid,))
        s = cursor.fetchone()
        broadcast_to_student(sid)
        return jsonify({'ok': True, 'student': {
            'id': s['id'], 'student_id': s['student_id'],
            'full_name': s['full_name'], 'email': s['email'] or '',
            'course': s['course'] or '', 'year_level': s['year_level'] or '',
        }})
    except MySQLError as e:
        return jsonify({'ok': False, 'error': e.msg}), 500
    finally:
        close_db(conn, cursor)


# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════

if __name__ == '__main__':
    init_arduino()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)