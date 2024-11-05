# Copyright 2024 Joel Ikels
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


import csv
import random
from datetime import datetime, timedelta
import os

def generate_sample_data(filename, num_records=50000):
    accounts = ['A001', 'A002', 'A003', 'A004', 'A005']
    senders = ['John Doe', 'Jane Smith', 'Alice Johnson', 'Bob Brown', 'Charlie Davis']
    recipients = ['XYZ Corp', 'ABC Inc', '123 Services', 'Tech Solutions', 'Global Traders']

    # Create biased pairs for more frequent transactions
    biased_pairs = [
        ('John Doe', 'XYZ Corp'),
        ('Jane Smith', 'ABC Inc'),
        ('Alice Johnson', 'Tech Solutions'),
        ('Bob Brown', 'Global Traders'),
        ('Charlie Davis', '123 Services')
    ]

    with open(filename, 'w', newline='') as csvfile:
        fieldnames = ['Date', 'From Account', 'From Sender', 'To Account', 'To Recipient', 'Amount in Euro']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

        writer.writeheader()
        start_date = datetime(2023, 1, 1)
        for _ in range(num_records):
            date = start_date + timedelta(days=random.randint(0, 365))
            
            # 30% chance of using a biased pair
            if random.random() < 0.3:
                from_sender, to_recipient = random.choice(biased_pairs)
                from_account = random.choice(accounts)
                to_account = random.choice(accounts)
            else:
                from_sender = random.choice(senders)
                to_recipient = random.choice(recipients)
                from_account = random.choice(accounts)
                to_account = random.choice(accounts)

            # 10% chance of internal transfer (same account)
            if random.random() < 0.1:
                to_account = from_account

            writer.writerow({
                'Date': date.strftime('%Y-%m-%d'),
                'From Account': from_account,
                'From Sender': from_sender,
                'To Account': to_account,
                'To Recipient': to_recipient,
                'Amount in Euro': round(random.uniform(100, 10000), 2)
            })

if __name__ == "__main__":
    dir_path = os.path.dirname(os.path.realpath(__file__))
    generate_sample_data(os.path.join(dir_path, 'data/sample_transactions_xxl.csv'))
    print("Sample data generated in 'sample_transactions.csv'")