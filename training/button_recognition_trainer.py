"""
Button Recognition Model Trainer
Trains a simple CNN to recognize Tower 3D UI elements from annotated data
"""
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import cv2
import numpy as np
import json
from pathlib import Path
from datetime import datetime

class UIElementDataset(Dataset):
    """Dataset for UI element patches"""
    def __init__(self, annotations_file, transform=None):
        with open(annotations_file, 'r') as f:
            self.data = json.load(f)
        
        self.elements = self.data['ui_elements']
        self.transform = transform
        
        # Create label mapping
        self.label_to_idx = {}
        self.idx_to_label = {}
        unique_types = set(elem['type'] for elem in self.elements)
        for idx, label in enumerate(sorted(unique_types)):
            self.label_to_idx[label] = idx
            self.idx_to_label[idx] = label
        
        print(f"✓ Dataset loaded: {len(self.elements)} elements")
        print(f"  Classes: {list(self.label_to_idx.keys())}")
    
    def __len__(self):
        return len(self.elements)
    
    def __getitem__(self, idx):
        elem = self.elements[idx]
        
        # Load image
        img_path = elem['image']
        # Handle relative paths
        if not Path(img_path).exists():
            img_path = Path("training_data/ui_elements/screenshots") / Path(img_path).name
        
        img = cv2.imread(str(img_path))
        
        # Extract ROI using bbox
        bbox = elem['bbox']
        x, y, w, h = bbox['x'], bbox['y'], bbox['width'], bbox['height']
        roi = img[y:y+h, x:x+w]
        
        # Resize to standard size
        roi = cv2.resize(roi, (64, 64))
        
        # Convert to tensor (C, H, W)
        roi = roi.transpose(2, 0, 1).astype(np.float32) / 255.0
        roi = torch.from_numpy(roi)
        
        if self.transform:
            roi = self.transform(roi)
        
        # Get label
        label = self.label_to_idx[elem['type']]
        
        return roi, label, elem['label']  # Return element name too


class ButtonRecognitionCNN(nn.Module):
    """Simple CNN for button/UI element classification"""
    def __init__(self, num_classes):
        super().__init__()
        
        self.features = nn.Sequential(
            # Conv block 1
            nn.Conv2d(3, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),  # 64 -> 32
            
            # Conv block 2
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),  # 32 -> 16
            
            # Conv block 3
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),  # 16 -> 8
        )
        
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128 * 8 * 8, 256),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(256, num_classes)
        )
    
    def forward(self, x):
        x = self.features(x)
        x = self.classifier(x)
        return x


class ButtonRecognitionTrainer:
    """Train button recognition model"""
    def __init__(self, annotations_file="training_data/ui_elements/annotations.json"):
        self.annotations_file = Path(annotations_file)
        
        if not self.annotations_file.exists():
            raise FileNotFoundError(f"Annotations file not found: {annotations_file}")
        
        # Load dataset
        self.dataset = UIElementDataset(self.annotations_file)
        
        if len(self.dataset) < 10:
            print(f"\n⚠ Warning: Only {len(self.dataset)} samples!")
            print("  You need more annotated data for good training.")
            print("  Run ui_element_annotator.py to collect more samples.\n")
        
        # Split train/val
        train_size = int(0.8 * len(self.dataset))
        val_size = len(self.dataset) - train_size
        self.train_dataset, self.val_dataset = torch.utils.data.random_split(
            self.dataset, [train_size, val_size]
        )
        
        # Create dataloaders
        self.train_loader = DataLoader(self.train_dataset, batch_size=16, shuffle=True)
        self.val_loader = DataLoader(self.val_dataset, batch_size=16, shuffle=False)
        
        # Create model
        self.num_classes = len(self.dataset.label_to_idx)
        self.model = ButtonRecognitionCNN(self.num_classes)
        
        # Training setup
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model.to(self.device)
        
        self.criterion = nn.CrossEntropyLoss()
        self.optimizer = optim.Adam(self.model.parameters(), lr=0.001)
        
        print(f"\n✓ Trainer initialized")
        print(f"  Device: {self.device}")
        print(f"  Train samples: {train_size}")
        print(f"  Val samples: {val_size}")
        print(f"  Classes: {self.num_classes}")
    
    def train_epoch(self):
        """Train for one epoch"""
        self.model.train()
        total_loss = 0.0
        correct = 0
        total = 0
        
        for images, labels, _ in self.train_loader:
            images = images.to(self.device)
            labels = labels.to(self.device)
            
            # Forward
            outputs = self.model(images)
            loss = self.criterion(outputs, labels)
            
            # Backward
            self.optimizer.zero_grad()
            loss.backward()
            self.optimizer.step()
            
            # Stats
            total_loss += loss.item()
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()
        
        avg_loss = total_loss / len(self.train_loader)
        accuracy = 100.0 * correct / total
        
        return avg_loss, accuracy
    
    def validate(self):
        """Validate model"""
        self.model.eval()
        total_loss = 0.0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for images, labels, _ in self.val_loader:
                images = images.to(self.device)
                labels = labels.to(self.device)
                
                outputs = self.model(images)
                loss = self.criterion(outputs, labels)
                
                total_loss += loss.item()
                _, predicted = outputs.max(1)
                total += labels.size(0)
                correct += predicted.eq(labels).sum().item()
        
        avg_loss = total_loss / len(self.val_loader) if len(self.val_loader) > 0 else 0
        accuracy = 100.0 * correct / total if total > 0 else 0
        
        return avg_loss, accuracy
    
    def train(self, epochs=50):
        """Full training loop"""
        print(f"\n{'='*70}")
        print(f"TRAINING BUTTON RECOGNITION MODEL")
        print(f"{'='*70}\n")
        
        best_val_acc = 0.0
        
        for epoch in range(epochs):
            train_loss, train_acc = self.train_epoch()
            val_loss, val_acc = self.validate()
            
            print(f"Epoch {epoch+1}/{epochs}")
            print(f"  Train: Loss={train_loss:.4f}, Acc={train_acc:.2f}%")
            print(f"  Val:   Loss={val_loss:.4f}, Acc={val_acc:.2f}%")
            
            # Save best model
            if val_acc > best_val_acc:
                best_val_acc = val_acc
                self.save_model("models/button_recognition_best.pth")
                print(f"  ✓ New best model saved! (Val Acc: {val_acc:.2f}%)")
            
            print()
        
        print(f"{'='*70}")
        print(f"TRAINING COMPLETE")
        print(f"{'='*70}")
        print(f"Best validation accuracy: {best_val_acc:.2f}%")
    
    def save_model(self, path):
        """Save model checkpoint"""
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        
        checkpoint = {
            'model_state_dict': self.model.state_dict(),
            'label_to_idx': self.dataset.label_to_idx,
            'idx_to_label': self.dataset.idx_to_label,
            'num_classes': self.num_classes,
            'timestamp': datetime.now().isoformat()
        }
        
        torch.save(checkpoint, path)
        print(f"✓ Model saved: {path}")


def main():
    """Main training script"""
    print("\n" + "="*70)
    print("BUTTON RECOGNITION TRAINER")
    print("="*70)
    
    try:
        trainer = ButtonRecognitionTrainer()
        
        print("\nReady to train!")
        print("Press Enter to start training, or Ctrl+C to cancel...")
        input()
        
        trainer.train(epochs=50)
        
    except FileNotFoundError as e:
        print(f"\n✗ Error: {e}")
        print("\nYou need to collect training data first!")
        print("Run: python training/ui_element_annotator.py")
    
    except KeyboardInterrupt:
        print("\n\n⊠ Training cancelled")


if __name__ == "__main__":
    main()
