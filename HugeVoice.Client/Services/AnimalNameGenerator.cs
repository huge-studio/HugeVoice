using System;
using System.Collections.Generic;

namespace HugeVoice.Client.Services;

public class AnimalNameGenerator
{
    private static readonly List<string> Adjectives = new()
    {
        "Happy", "Sad", "Angry", "Excited", "Calm", "Brave", "Shy", "Loud", "Quiet", "Fast",
        "Slow", "Big", "Small", "Tall", "Short", "Smart", "Silly", "Funny", "Serious", "Playful",
        "Lazy", "Active", "Sleepy", "Awake", "Hungry", "Full", "Thirsty", "Satisfied", "Curious", "Bored",
        "Cheerful", "Grumpy", "Friendly", "Mean", "Kind", "Rude", "Polite", "Impatient", "Patient", "Nervous",
        "Confident", "Worried", "Relaxed", "Stressed", "Joyful", "Miserable", "Optimistic", "Pessimistic", "Energetic", "Tired",
        "Creative", "Boring", "Interesting", "Dull", "Bright", "Dark", "Colorful", "Plain", "Fancy", "Simple",
        "Rich", "Poor", "Lucky", "Unlucky", "Famous", "Unknown", "Popular", "Unpopular", "Strong", "Weak",
        "Healthy", "Sick", "Clean", "Dirty", "Fresh", "Stale", "New", "Old", "Young", "Ancient",
        "Modern", "Classic", "Trendy", "Outdated", "Cool", "Hot", "Cold", "Warm", "Freezing", "Burning",
        "Wet", "Dry", "Smooth", "Rough", "Soft", "Hard", "Light", "Heavy", "Thin", "Thick",
        "Wide", "Narrow", "Long", "Short", "Round", "Square", "Sharp", "Blunt", "Pointed", "Flat",
        "Curved", "Straight", "Twisted", "Bent", "Broken", "Fixed", "Open", "Closed", "Full", "Empty",
        "Busy", "Free", "Occupied", "Available", "Reserved", "Public", "Private", "Secret", "Obvious", "Hidden",
        "Visible", "Invisible", "Clear", "Blurry", "Sharp", "Fuzzy", "Loud", "Silent", "Noisy", "Peaceful"
    };

    private static readonly List<string> Animals = new()
    {
        "Aardvark", "Albatross", "Alligator", "Alpaca", "Ant", "Anteater", "Antelope", "Ape", "Armadillo",
        "Baboon", "Badger", "Barracuda", "Bat", "Bear", "Beaver", "Bee", "Bison", "Boar", "Buffalo",
        "Butterfly", "Camel", "Capybara", "Caribou", "Cassowary", "Cat", "Caterpillar", "Cattle", "Chamois",
        "Cheetah", "Chicken", "Chimpanzee", "Chinchilla", "Chough", "Clam", "Cobra", "Cockroach", "Cod",
        "Cormorant", "Coyote", "Crab", "Crane", "Crocodile", "Crow", "Curlew", "Deer", "Dinosaur", "Dog",
        "Dogfish", "Dolphin", "Dotterel", "Dove", "Dragonfly", "Duck", "Dugong", "Dunlin", "Eagle", "Echidna",
        "Eel", "Eland", "Elephant", "Elk", "Emu", "Falcon", "Ferret", "Finch", "Fish", "Flamingo", "Fly",
        "Fox", "Frog", "Gaur", "Gazelle", "Gerbil", "Giraffe", "Gnat", "Gnu", "Goat", "Goldfinch", "Goldfish",
        "Goose", "Gorilla", "Goshawk", "Grasshopper", "Grouse", "Guanaco", "Gull", "Hamster", "Hare",
        "Hawk", "Hedgehog", "Heron", "Herring", "Hippopotamus", "Hornet", "Horse", "Human", "Hummingbird",
        "Hyena", "Ibex", "Ibis", "Jackal", "Jaguar", "Jay", "Jellyfish", "Kangaroo", "Kingfisher", "Koala",
        "Kookabura", "Kouprey", "Kudu", "Lapwing", "Lark", "Lemur", "Leopard", "Lion", "Llama", "Lobster",
        "Locust", "Loris", "Louse", "Lyrebird", "Magpie", "Mallard", "Manatee", "Mandrill", "Mantis",
        "Marten", "Mastiff", "Mayfly", "Meerkat", "Mink", "Mole", "Mongoose", "Monkey", "Moose", "Mosquito",
        "Mouse", "Mule", "Narwhal", "Newt", "Nightingale", "Octopus", "Okapi", "Opossum", "Oryx", "Ostrich",
        "Otter", "Owl", "Oyster", "Panther", "Parrot", "Partridge", "Peafowl", "Pelican", "Penguin", "Pheasant",
        "Pig", "Pigeon", "Pinscher", "Platypus", "Polarbear", "Pony", "Porcupine", "Porpoise", "Quail",
        "Quelea", "Quetzal", "Rabbit", "Raccoon", "Rail", "Ram", "Rat", "Raven", "Reindeer", "Rhinoceros",
        "Rook", "Salamander", "Salmon", "Sandpiper", "Sardine", "Scorpion", "Seahorse", "Seal", "Shark",
        "Sheep", "Shrew", "Skunk", "Snail", "Snake", "Sparrow", "Spider", "Spoonbill", "Squid", "Squirrel",
        "Starling", "Stingray", "Stinkbug", "Stork", "Swallow", "Swan", "Tapir", "Tarsier", "Termite",
        "Tiger", "Toad", "Trout", "Turkey", "Turtle", "Viper", "Vulture", "Wallaby", "Walrus", "Wasp",
        "Weasel", "Whale", "Wildcat", "Wolf", "Wolverine", "Wombat", "Woodcock", "Woodpecker", "Worm",
        "Wren", "Yak", "Zebra"
    };

    private readonly Random _random = new();

    public string GenerateChannelName()
    {
        var adjective = Adjectives[_random.Next(Adjectives.Count)];
        var animal = Animals[_random.Next(Animals.Count)];
        
        return $"{adjective}-{animal}";
    }

    public bool IsValidChannelName(string channelName)
    {
        if (string.IsNullOrWhiteSpace(channelName))
            return false;

        // Allow alphanumeric characters, hyphens, and underscores
        // Must be between 3 and 50 characters
        return channelName.Length >= 3 && 
               channelName.Length <= 50 && 
               System.Text.RegularExpressions.Regex.IsMatch(channelName, @"^[a-zA-Z0-9\-_]+$");
    }

    public string SanitizeChannelName(string channelName)
    {
        if (string.IsNullOrWhiteSpace(channelName))
            return GenerateChannelName();

        // Replace spaces and special characters with hyphens, then clean up
        var sanitized = System.Text.RegularExpressions.Regex.Replace(channelName.Trim(), @"[^a-zA-Z0-9\-_]", "-");
        sanitized = System.Text.RegularExpressions.Regex.Replace(sanitized, @"-+", "-");
        sanitized = sanitized.Trim('-');

        if (sanitized.Length < 3 || sanitized.Length > 50)
        {
            return GenerateChannelName();
        }

        return sanitized;
    }
}