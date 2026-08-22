export function calculateSeatUpdate(previousOccupied, boarded, deboarded, capacity) {
    if (![previousOccupied, boarded, deboarded, capacity].every(Number.isInteger)) {
        throw new Error("Passenger and capacity values must be whole numbers.");
    }
    if (capacity <= 0)
        throw new Error("Bus capacity must be greater than zero.");
    if (previousOccupied < 0 || previousOccupied > capacity) {
        throw new Error("Previous occupancy is outside the bus capacity.");
    }
    if (boarded < 0 || deboarded < 0) {
        throw new Error("Passenger counts cannot be negative.");
    }
    const occupiedSeats = previousOccupied + boarded - deboarded;
    if (occupiedSeats < 0) {
        throw new Error("Deboarded students cannot exceed the current occupied count.");
    }
    if (occupiedSeats > capacity) {
        throw new Error("This update would exceed the bus capacity.");
    }
    return { occupiedSeats, availableSeats: capacity - occupiedSeats };
}
