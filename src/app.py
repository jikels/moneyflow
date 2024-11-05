import io
import os
import csv
import json
from datetime import datetime, timedelta

import multiprocessing
multiprocessing.freeze_support()

import pandas as pd
from flask import Flask, render_template, request, jsonify, url_for, send_file, redirect
from werkzeug.utils import secure_filename

from src.data_processor import TransactionData
from src.graph_manager import TransactionGraph

app = Flask(__name__)

dir_path = os.path.dirname(os.path.realpath(__file__))

# Configure upload folder
UPLOAD_FOLDER = os.path.join(dir_path, 'data', 'uploads')
SAVE_FOLDER = os.path.join(dir_path, 'data', 'saved_states')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Create directories if they don't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(SAVE_FOLDER, exist_ok=True)

def clean():
    save_dir = os.path.join(dir_path, 'data/saved_states')
    upload_dir = os.path.join(dir_path, 'data/uploads')
    
    # Get current time
    now = datetime.now()

    for dir in [save_dir, upload_dir]:
        # Remove files older than 24 hours
        for filename in os.listdir(dir):
            file_path = os.path.join(dir, filename)
            if os.path.isfile(file_path):
                os.remove(file_path)

@app.route('/')
def intro():
    clean()
    return render_template('intro.html')

@app.route('/upload_csv', methods=['POST'])
def upload_csv():
    if 'csv_file' not in request.files:
        return redirect(url_for('intro'))
    
    file = request.files['csv_file']
    
    if file.filename == '':
        return redirect(url_for('intro'))
    
    if file and file.filename.endswith('.csv'):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # Load the transaction data
        global transaction_data
        transaction_data = TransactionData(file_path)
        
        return redirect(url_for('index'))
    
    return redirect(url_for('intro'))

@app.route('/visualization')
def index():
    if 'transaction_data' not in globals():
        return redirect(url_for('intro'))
    
    # Create initial graph with all data
    initial_graph = TransactionGraph(transaction_data.data)
    initial_graph.create_graph()
    initial_graph.customize_graph(display_amounts=True, proportional_edges=True)
    initial_graph.toggle_physics(enable_physics=True)
    initial_graph_data = initial_graph.get_graph_data()

    # Ensure the data is JSON-serializable
    try:
        json.dumps(initial_graph_data)
    except TypeError as e:
        print(f"Error: initial_graph_data is not JSON-serializable: {e}")
        initial_graph_data = {}

    # Convert the graph data to a JSON-serializable format
    serializable_graph_data = {
        'nodes': [dict(node) for node in initial_graph_data['nodes']],
        'edges': [dict(edge) for edge in initial_graph_data['edges']]
    }

    # Get unique accounts and senders/recipients for dropdowns
    unique_from_accounts, unique_to_accounts = transaction_data.get_unique_accounts()
    unique_senders, unique_recipients = transaction_data.get_unique_senders_recipients()

    return render_template('index.html', 
                           initial_graph_data=serializable_graph_data,
                           from_accounts=unique_from_accounts,
                           to_accounts=unique_to_accounts,
                           senders=unique_senders,
                           recipients=unique_recipients)
@app.route('/get_graph_data', methods=['POST'])
def get_graph_data():
    # Extract filter parameters from the request
    from_account = request.form.get('from_account', '')
    to_account = request.form.get('to_account', '')
    from_sender = request.form.get('from_sender', '')
    to_recipient = request.form.get('to_recipient', '')
    min_amount = float(request.form.get('min_amount') or 0)
    max_amount = float(request.form.get('max_amount') or float('inf'))
    from_date = pd.to_datetime(request.form.get('from_date') or '1900-01-01')
    to_date = pd.to_datetime(request.form.get('to_date') or '2100-12-31')
    display_amounts = request.form.get('display_amounts') == 'true'
    enable_physics = request.form.get('enable_physics') == 'true'
    proportional_edges = request.form.get('proportional_edges') == 'true'

    print(f"Received filter parameters: {from_account}, {to_account}, {from_sender}, {to_recipient}, {min_amount}, {max_amount}, {from_date}, {to_date}, {display_amounts}, {enable_physics}, {proportional_edges}")

    # Filter the data
    filtered_data = transaction_data.filter_data(
        from_account, to_account, from_sender, to_recipient,
        min_amount, max_amount, from_date, to_date
    )

    # Create and customize the graph
    graph = TransactionGraph(filtered_data)
    graph.create_graph()
    graph.customize_graph(display_amounts, proportional_edges)
    graph.toggle_physics(enable_physics)

    # Get the graph data
    graph_data = graph.get_graph_data()

    # Calculate Summary Statistics
    total_transactions = len(filtered_data)
    if total_transactions > 0:
        largest_transaction = filtered_data['Amount in Euro'].max()
        most_frequent_sender = filtered_data['From Sender'].mode()[0]
        most_frequent_recipient = filtered_data['To Recipient'].mode()[0]
        total_sent = filtered_data.groupby('From Sender')['Amount in Euro'].sum().to_dict()
        total_received = filtered_data.groupby('To Recipient')['Amount in Euro'].sum().to_dict()
    else:
        largest_transaction = 0
        most_frequent_sender = "N/A"
        most_frequent_recipient = "N/A"
        total_sent = {}
        total_received = {}
    summary_stats = {
        "total_transactions": total_transactions,
        "largest_transaction": largest_transaction,
        "most_frequent_sender": most_frequent_sender,
        "most_frequent_recipient": most_frequent_recipient,
        "total_sent": total_sent,
        "total_received": total_received
    }

    return jsonify({
        "graph_data": graph_data,
        "summary_stats": summary_stats,
        "filtered_data": filtered_data.to_dict('records')  # Add this line
    })
@app.route('/get_unique_accounts')
def get_unique_accounts():
    unique_from_accounts, unique_to_accounts = transaction_data.get_unique_accounts()
    return jsonify({
        'from_accounts': unique_from_accounts,
        'to_accounts': unique_to_accounts
    })

@app.route('/get_transaction_history', methods=['POST'])
def get_transaction_history():
    from_label = request.form.get('from_label')
    to_label = request.form.get('to_label')
    
    print(f"Fetching transaction history for: {from_label} -> {to_label}")
    
    filtered_data = transaction_data.get_transaction_history(from_label, to_label)
    
    print(f"Found {len(filtered_data)} transactions")
    
    result = {
        'transactions': filtered_data.to_dict('records'),
        'csv': filtered_data.to_csv(index=False)
    }
    
    return jsonify(result)

@app.route('/get_filtered_transactions', methods=['POST'])
def get_filtered_transactions():
    print("Received request for filtered transactions")
    print("Form data:", request.form)
    
    if request.form.get('use_filters') == 'true':
        from_account = request.form.get('from_account', '')
        to_account = request.form.get('to_account', '')
        from_sender = request.form.get('from_sender', '')
        to_recipient = request.form.get('to_recipient', '')
        min_amount = float(request.form.get('min_amount') or 0)
        max_amount = float(request.form.get('max_amount') or float('inf'))
        from_date = pd.to_datetime(request.form.get('from_date') or '1900-01-01')
        to_date = pd.to_datetime(request.form.get('to_date') or '2100-12-31')
        
        print(f"Applying filters: {from_account}, {to_account}, {from_sender}, {to_recipient}, {min_amount}, {max_amount}, {from_date}, {to_date}")
        
        filtered_data = transaction_data.filter_data(
            from_account, to_account, from_sender, to_recipient,
            min_amount, max_amount, from_date, to_date
        )
    else:
        from_label = request.form.get('from_label')
        to_label = request.form.get('to_label')
        print(f"Fetching transactions for labels: {from_label} -> {to_label}")
        if from_label == to_label:
            filtered_data = transaction_data.get_transactions_for_entity(from_label)
        else:
            filtered_data = transaction_data.get_transaction_history(from_label, to_label)
    
    transactions = filtered_data.to_dict('records')
    print(f"Number of filtered transactions: {len(transactions)}")
    
    return jsonify({
        'transactions': transactions
    })
@app.route('/get_icons')
def get_icons():
    icons_dir = os.path.join(app.static_folder, 'data', 'icons')
    print(f"Icons directory: {icons_dir}")
    icons = []
    for filename in os.listdir(icons_dir):
        if filename.lower().endswith('.png'):
            icon_url = url_for('static', filename=f'data/icons/{filename}')
            icons.append({'name': filename, 'url': icon_url})
    return jsonify({'icons': icons})

@app.route('/annotate')
def annotate():
    csv_file = request.args.get('csv_file')
    if not csv_file:
        return "No CSV file specified", 400

    csv_path = os.path.join(app.config['UPLOAD_FOLDER'], csv_file)
    if not os.path.exists(csv_path):
        return "CSV file not found", 404

    # Load the filtered data
    filtered_data = pd.read_csv(csv_path)

    # Create a new graph with the filtered data
    graph = TransactionGraph(filtered_data)
    graph.create_graph()
    graph.customize_graph(display_amounts=True, proportional_edges=True)
    graph.toggle_physics(enable_physics=True)
    graph_data = graph.get_graph_data()

    return render_template('annotation.html', initial_graph_data=json.dumps(graph_data))
@app.route('/save_graph_state', methods=['POST'])
def save_graph_state():
    data = request.get_json()
    graph_state = data['graph_state']
    filtered_data = data['filtered_data']

    # Save the filtered data to a CSV file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_filename = f'filtered_data_{timestamp}.csv'
    csv_path = os.path.join(app.config['UPLOAD_FOLDER'], csv_filename)
    
    df = pd.DataFrame(filtered_data)
    df.to_csv(csv_path, index=False)

    return jsonify({'success': True, 'csv_file': csv_filename})

@app.route('/transaction_table')
def transaction_table():
    return render_template('transaction_table.html')

@app.route('/download_csv', methods=['POST'])
def download_csv():
    print("request form: ", request.form)
    use_filters = 'from_account' in request.form or 'from_label' not in request.form
    
    if use_filters:
        from_account = request.form.get('from_account', '')
        to_account = request.form.get('to_account', '')
        from_sender = request.form.get('from_sender', '')
        to_recipient = request.form.get('to_recipient', '')
        min_amount = float(request.form.get('min_amount') or 0)
        max_amount = float(request.form.get('max_amount') or float('inf'))
        from_date = pd.to_datetime(request.form.get('from_date') or '1900-01-01')
        to_date = pd.to_datetime(request.form.get('to_date') or '2100-12-31')
        
        filtered_data = transaction_data.filter_data(
            from_account, to_account, from_sender, to_recipient,
            min_amount, max_amount, from_date, to_date
        )
    else:
        from_label = request.form.get('from_label')
        to_label = request.form.get('to_label')
        filtered_data = transaction_data.get_transaction_history(from_label, to_label)
    
    # Create a CSV string
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow(['Date', 'From', 'To', 'Amount (EUR)'])
    
    # Write data
    for _, row in filtered_data.iterrows():
        writer.writerow([row['Date'], row['From Label'], row['To Label'], row['Amount in Euro']])
    
    # Create a response with the CSV data
    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode('utf-8')),
        mimetype='text/csv',
        as_attachment=True,
        download_name='filtered_transactions.csv' if use_filters else f'transactions_{from_label}_to_{to_label}.csv'
    )

@app.route('/upload_icon', methods=['POST'])
def upload_icon():
    if 'icon' not in request.files:
        return jsonify({'success': False, 'error': 'No file part'})
    
    file = request.files['icon']
    
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No selected file'})
    
    if file and file.filename.lower().endswith('.png'):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.static_folder, 'data', 'icons', filename)
        file.save(file_path)
        icon_url = url_for('static', filename=f'data/icons/{filename}')
        return jsonify({'success': True, 'icon': {'name': filename, 'url': icon_url}})
    else:
        return jsonify({'success': False, 'error': 'Invalid file type'})

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5001)

