void setup() {
    Serial.begin(9600);
    randomSeed(analogRead(0)); // Seed random number generator
}

void loop() {
    int randNumber = random(0, 100); // Generate random number between 0 and 99
    Serial.print("Random Number: ");
    Serial.println(randNumber);
    delay(1000); // Wait for 1 second
}