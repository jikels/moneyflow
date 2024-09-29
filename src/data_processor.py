import pandas as pd

class TransactionData:
    def __init__(self, file):
        print(f"Loading transaction data from {file}")
        self.data = pd.read_csv(file)
        self.prepare_data()

    def prepare_data(self):
        self.data['From Account'] = self.data['From Account'].astype(str)
        self.data['To Account'] = self.data['To Account'].astype(str)
        self.data['From Sender'] = self.data['From Sender'].astype(str)
        self.data['To Recipient'] = self.data['To Recipient'].astype(str)
        self.data['Date'] = pd.to_datetime(self.data['Date'], format="mixed")
        self.data = self.data[self.data['Amount in Euro'] > 0]

        self.data['From Label'] = self.data.apply(
            lambda x: f"{x['From Sender']} ({x['From Account']})" if x['From Account'] else x['From Sender'],
            axis=1
        )
        self.data['To Label'] = self.data.apply(
            lambda x: f"{x['To Recipient']} ({x['To Account']})" if x['To Account'] else x['To Recipient'],
            axis=1
        )

    def filter_data(self, from_account, to_account, from_sender, to_recipient, min_amount, max_amount, from_date, to_date):
        print(f"Filtering data with parameters: {from_account}, {to_account}, {from_sender}, {to_recipient}, {min_amount}, {max_amount}, {from_date}, {to_date}")
        filtered_data = self.data[
            ((self.data['From Account'].str.contains(from_account, case=False, na=False)) | (from_account == '')) &
            ((self.data['To Account'].str.contains(to_account, case=False, na=False)) | (to_account == '')) &
            ((self.data['From Sender'].str.contains(from_sender, case=False, na=False)) | (from_sender == '')) &
            ((self.data['To Recipient'].str.contains(to_recipient, case=False, na=False)) | (to_recipient == '')) &
            (self.data['Amount in Euro'] >= min_amount) &
            (self.data['Amount in Euro'] <= max_amount) &
            (self.data['Date'] >= from_date) &
            (self.data['Date'] <= to_date)
        ]
        print(f"Filtered data shape: {filtered_data.shape}")
        return filtered_data

    def get_unique_accounts(self):
        unique_from_accounts = sorted(self.data['From Account'].unique().tolist())
        unique_to_accounts = sorted(self.data['To Account'].unique().tolist())
        return unique_from_accounts, unique_to_accounts

    def get_unique_senders_recipients(self):
        unique_senders = sorted(self.data['From Sender'].unique().tolist())
        unique_recipients = sorted(self.data['To Recipient'].unique().tolist())
        return unique_senders, unique_recipients

    def get_transaction_history(self, from_label, to_label):
        print(f"Searching for transactions between '{from_label}' and '{to_label}'")
        
        # Split the labels into name and account parts
        from_name, from_account = self.split_label(from_label)
        to_name, to_account = self.split_label(to_label)
        
        print(f"From: name='{from_name}', account='{from_account}'")
        print(f"To: name='{to_name}', account='{to_account}'")
        
        # Filter the data based on the split labels
        filtered_data = self.data[
            (
                ((self.data['From Label'] == from_label) & (self.data['To Label'] == to_label)) |
                ((self.data['From Label'] == to_label) & (self.data['To Label'] == from_label))
            ) |
            (
                ((self.data['From Sender'] == from_name) & (self.data['From Account'] == from_account) &
                 (self.data['To Recipient'] == to_name) & (self.data['To Account'] == to_account)) |
                ((self.data['From Sender'] == to_name) & (self.data['From Account'] == to_account) &
                 (self.data['To Recipient'] == from_name) & (self.data['To Account'] == from_account))
            )
        ]
        
        print(f"Filtered data shape: {filtered_data.shape}")
        if filtered_data.empty:
            print("No transactions found.")
        else:
            print("First few rows of filtered data:")
            print(filtered_data.head())
        
        return filtered_data.sort_values('Date')

    def split_label(self, label):
        if label is None:
            return '', ''
        if '(' in label and ')' in label:
            name, account = label.rsplit('(', 1)
            name = name.strip()
            account = account.rstrip(')')
        else:
            name = label
            account = ''
        return name, account

    def get_transactions_for_entity(self, label):
        print(f"Searching for transactions involving '{label}'")
        
        name, account = self.split_label(label)
        
        filtered_data = self.data[
            ((self.data['From Sender'] == name) & (self.data['From Account'] == account)) |
            ((self.data['To Recipient'] == name) & (self.data['To Account'] == account))
        ]
        
        print(f"Filtered data shape: {filtered_data.shape}")
        if filtered_data.empty:
            print("No transactions found.")
        else:
            print("First few rows of filtered data:")
            print(filtered_data.head())
        
        return filtered_data.sort_values('Date')